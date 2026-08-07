import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getVoiceServerClient, romeDateKey } from '@/lib/voice-task-server';
import { buildVoiceTaskMessage, type VoicePinResult } from '@/lib/today-priority-ranking';

const taskPriorities = ['high', 'medium', 'low'] as const;
const taskAssignees = ['Virgilio', 'Marco', 'Ida'] as const;

type VoiceTaskRpcResult = {
  task_id: string;
  is_today_priority: boolean;
  pin_result: VoicePinResult;
  replaced_task_text: string | null;
};

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

function taskNotes(notes: string | undefined, assignee: string | undefined) {
  return [assignee ? `[[responsabile:${assignee}]]` : '', notes?.trim() ?? ''].filter(Boolean).join('\n\n');
}

export function createTaskPortalMcpServer() {
  const server = new McpServer(
    { name: 'task-portal', version: '1.0.0' },
    {
      instructions: 'Gestisci il Task Portal di Virgilio. Prima cerca il progetto se la richiesta è ambigua. Per creare task, raccogli titolo, progetto, responsabile, scadenza e priorità solo quando sono indicati o necessari. Non inventare campi.',
    },
  );

  server.registerTool(
    'list_projects',
    {
      title: 'Elenca i progetti attivi',
      description: 'Usa questa azione per individuare il progetto corretto prima di creare o aggiornare un task.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const { data, error } = await getVoiceServerClient().from('projects').select('id, name, status').neq('status', 'done').eq('is_area', false).order('name');
      if (error) throw new Error('Non riesco a leggere i progetti.');
      return textResult({ projects: data ?? [] });
    },
  );

  server.registerTool(
    'create_task',
    {
      title: 'Crea un task',
      description: 'Crea un task strutturato nel Task Portal. Usa pin_today solo se l’utente chiede esplicitamente di fissarlo tra le tre priorità di oggi; usa force_pin solo se autorizza esplicitamente a sostituirne una.',
      inputSchema: {
        title: z.string().min(3).max(500).describe('Titolo breve e operativo del task.'),
        notes: z.string().max(4000).optional().describe('Dettagli, elenco di documenti o contesto utile.'),
        priority: z.enum(taskPriorities).default('medium').describe('Priorità richiesta.'),
        due_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).optional().describe('Scadenza ISO YYYY-MM-DD, solo se detta o concordata.'),
        project_name: z.string().max(200).optional().describe('Nome del progetto già verificato con list_projects.'),
        assignee: z.enum(taskAssignees).optional().describe('Responsabile, solo se esplicitamente richiesto.'),
        pin_today: z.boolean().default(false).describe('Fissa tra le priorità di oggi soltanto su richiesta esplicita.'),
        force_pin: z.boolean().default(false).describe('Sostituisce una priorità esistente soltanto su autorizzazione esplicita.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ title, notes, priority, due_date, project_name, assignee, pin_today, force_pin }) => {
      const supabase = getVoiceServerClient();
      let projectId: string | null = null;
      let resolvedProject: string | null = null;
      if (project_name) {
        const { data, error } = await supabase.from('projects').select('id, name').ilike('name', project_name).neq('status', 'done').eq('is_area', false).limit(2);
        if (error) throw new Error('Non riesco a verificare il progetto.');
        if ((data ?? []).length !== 1) throw new Error(`Progetto non univoco o inesistente: ${project_name}. Usa list_projects e riprova con il nome esatto.`);
        projectId = data![0].id;
        resolvedProject = data![0].name;
      }
      const pinMode = force_pin ? 'force' : pin_today ? 'pin' : 'none';
      const { data, error } = await supabase.rpc('create_voice_task_with_priority_policy', {
        p_text: title.trim(), p_notes: taskNotes(notes, assignee), p_project_id: projectId, p_priority: priority,
        p_due_date: due_date ?? null, p_needs_review: false, p_pin_mode: pinMode,
      }).single();
      if (error || !data) throw new Error('Non sono riuscito a creare il task.');
      const task = data as VoiceTaskRpcResult;
      return textResult({
        message: buildVoiceTaskMessage({ title: title.trim(), needsReview: false, pinResult: task.pin_result, replacedTaskText: task.replaced_task_text }),
        task: { id: task.task_id, title: title.trim(), notes: notes ?? null, priority, due_date: due_date ?? null, project: resolvedProject, assignee: assignee ?? null, is_today_priority: task.is_today_priority },
        today: romeDateKey(),
      });
    },
  );

  return server;
}
