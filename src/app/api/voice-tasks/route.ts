import { parseVoiceTask } from '@/lib/voice-task-parser';
import { getBearerToken, getVoiceServerClient, hashVoiceToken, noStoreJson, romeDateKey } from '@/lib/voice-task-server';

export const runtime = 'nodejs';

const MAX_TRANSCRIPT_LENGTH = 2_000;
const MAX_REQUESTS_PER_MINUTE = 12;

function taskNotes(assignee: string | null, reviewReasons: string[]) {
  const notes: string[] = [];
  if (assignee) notes.push(`[[responsabile:${assignee}]]`);
  if (reviewReasons.length > 0) notes.push(`Da rivedere: ${reviewReasons.join(' ')}`);
  return notes.join('\n');
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLocaleLowerCase().includes('application/json')) {
    return noStoreJson({ message: 'Invia un corpo JSON con la chiave transcript.' }, { status: 415 });
  }

  const rawToken = getBearerToken(request);
  if (!rawToken) return noStoreJson({ message: 'Token vocale mancante o non valido.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ message: 'Il corpo JSON non è valido.' }, { status: 400 });
  }

  const transcript = body && typeof body === 'object' && 'transcript' in body && typeof body.transcript === 'string'
    ? body.transcript.trim()
    : '';
  if (!transcript) return noStoreJson({ message: 'La trascrizione è vuota.' }, { status: 400 });
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return noStoreJson({ message: `La trascrizione supera ${MAX_TRANSCRIPT_LENGTH} caratteri.` }, { status: 413 });
  }

  try {
    const supabase = getVoiceServerClient();
    const tokenHash = hashVoiceToken(rawToken);
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('voice_task_tokens')
      .select('id, owner_profile')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .maybeSingle();

    if (tokenError || !tokenRecord) return noStoreJson({ message: 'Token vocale mancante, revocato o non valido.' }, { status: 401 });

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countError } = await supabase
      .from('voice_task_events')
      .select('id', { count: 'exact', head: true })
      .eq('token_id', tokenRecord.id)
      .gte('created_at', oneMinuteAgo);
    if (countError) return noStoreJson({ message: 'Servizio vocale temporaneamente non disponibile.' }, { status: 503 });
    if ((count ?? 0) >= MAX_REQUESTS_PER_MINUTE) {
      return noStoreJson({ message: 'Troppe richieste ravvicinate. Riprova tra un minuto.' }, { status: 429 });
    }

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .neq('status', 'done')
      .eq('is_area', false);
    if (projectError) return noStoreJson({ message: 'Non riesco a leggere i progetti disponibili.' }, { status: 503 });

    const parsed = parseVoiceTask(transcript, projects ?? [], romeDateKey());
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        text: parsed.title,
        notes: taskNotes(parsed.assignee, parsed.reviewReasons),
        project_id: parsed.projectId,
        priority: parsed.priority,
        due_date: parsed.dueDate,
        category: 'work',
        completed: false,
        workflow_status: 'active',
        is_today_priority: false,
        needs_review: parsed.needsReview,
        source: 'voice',
      })
      .select('id, text')
      .single();
    if (taskError || !task) return noStoreJson({ message: 'Non sono riuscito a creare il task.' }, { status: 503 });

    const message = parsed.needsReview
      ? `Creato da rivedere: ${parsed.title}`
      : `Task creato: ${parsed.title}`;

    await Promise.all([
      supabase.from('voice_task_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRecord.id),
      supabase.from('voice_task_events').insert({
        token_id: tokenRecord.id,
        owner_profile: tokenRecord.owner_profile,
        transcript_preview: transcript.slice(0, 160),
        parse_result: {
          title: parsed.title,
          priority: parsed.priority,
          due_date: parsed.dueDate,
          project: parsed.projectName,
          assignee: parsed.assignee,
          needs_review: parsed.needsReview,
          review_reasons: parsed.reviewReasons,
        },
        task_id: task.id,
        status: parsed.needsReview ? 'needs_review' : 'created',
        message,
      }),
    ]);

    return noStoreJson({
      message,
      needs_review: parsed.needsReview,
      task: {
        id: task.id,
        title: parsed.title,
        priority: parsed.priority,
        due_date: parsed.dueDate,
        project: parsed.projectName,
        assignee: parsed.assignee,
      },
    }, { status: 201 });
  } catch {
    return noStoreJson({ message: 'Servizio vocale non configurato sul server.' }, { status: 503 });
  }
}
