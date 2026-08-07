import {
  createVoicePairingCode,
  createVoiceToken,
  getBearerToken,
  getVoiceServerClient,
  hashVoicePairingCode,
  hashVoiceToken,
  isAuthorizedAdmin,
  isVoiceProfile,
  noStoreJson,
} from '@/lib/voice-task-server';

export const runtime = 'nodejs';

type TokenAction = 'status' | 'create_pairing' | 'generate' | 'regenerate' | 'revoke';

function isTokenAction(value: unknown): value is TokenAction {
  return value === 'status' || value === 'create_pairing' || value === 'generate' || value === 'regenerate' || value === 'revoke';
}

async function loadStatus(profile: string) {
  const supabase = getVoiceServerClient();
  const { data: token, error } = await supabase
    .from('voice_task_tokens')
    .select('id, token_prefix, created_at, last_used_at')
    .eq('owner_profile', profile)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const { data: recent, error: recentError } = await supabase
    .from('voice_task_events')
    .select('id, transcript_preview, status, message, created_at, parse_result')
    .eq('owner_profile', profile)
    .order('created_at', { ascending: false })
    .limit(5);
  if (recentError) throw recentError;

  return { token_state: token, recent: recent ?? [] };
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLocaleLowerCase().includes('application/json')) {
    return noStoreJson({ message: 'Invia un corpo JSON.' }, { status: 415 });
  }
  if (!isAuthorizedAdmin(getBearerToken(request))) {
    return noStoreJson({ message: 'Chiave di gestione mancante o non valida.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ message: 'Il corpo JSON non è valido.' }, { status: 400 });
  }
  const action = body && typeof body === 'object' && 'action' in body ? body.action : null;
  const profile = body && typeof body === 'object' && 'profile' in body ? body.profile : null;
  if (!isTokenAction(action) || !isVoiceProfile(profile)) {
    return noStoreJson({ message: 'Azione o profilo non validi.' }, { status: 400 });
  }

  try {
    const supabase = getVoiceServerClient();
    if (action === 'status') return noStoreJson(await loadStatus(profile));

    if (action === 'create_pairing') {
      const pairingCode = createVoicePairingCode();
      const pairingCodeHash = hashVoicePairingCode(pairingCode);
      if (!pairingCodeHash) throw new Error('Codice di abbinamento non valido.');

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
      const { error: expireError } = await supabase
        .from('voice_task_pairings')
        .update({ used_at: now.toISOString() })
        .eq('owner_profile', profile)
        .is('used_at', null);
      if (expireError) throw expireError;

      const { error: pairingError } = await supabase.from('voice_task_pairings').insert({
        owner_profile: profile,
        code_hash: pairingCodeHash,
        code_prefix: pairingCode.slice(0, 8),
        expires_at: expiresAt,
      });
      if (pairingError) throw pairingError;

      return noStoreJson({
        pairing_code: pairingCode,
        expires_at: expiresAt,
        message: `Codice monouso creato per ${profile}. Scade tra 15 minuti.`,
      }, { status: 201 });
    }

    if (action === 'revoke') {
      const { error } = await supabase
        .from('voice_task_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('owner_profile', profile)
        .is('revoked_at', null);
      if (error) throw error;
      return noStoreJson({ ...(await loadStatus(profile)), message: 'Token revocato.' });
    }

    const current = await loadStatus(profile);
    if (action === 'generate' && current.token_state) {
      return noStoreJson({ ...current, message: 'Esiste già un token attivo. Revocalo o rigeneralo.' }, { status: 409 });
    }

    const rawToken = createVoiceToken();
    const tokenHash = hashVoiceToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 11);

    if (action === 'regenerate') {
      const { error } = await supabase.rpc('rotate_voice_task_token', {
        profile_name: profile,
        new_token_hash: tokenHash,
        new_token_prefix: tokenPrefix,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('voice_task_tokens').insert({
        owner_profile: profile,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
      });
      if (error) throw error;
    }

    return noStoreJson({
      ...(await loadStatus(profile)),
      token: rawToken,
      message: action === 'regenerate'
        ? 'Token rigenerato. Il precedente non funziona più.'
        : 'Token generato. Copialo ora: non sarà più mostrato.',
    }, { status: 201 });
  } catch {
    return noStoreJson({ message: 'Gestione token non disponibile: verifica schema e configurazione server.' }, { status: 503 });
  }
}
