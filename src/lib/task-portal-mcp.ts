import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getVoiceServerClient, romeDateKey } from '@/lib/voice-task-server';
import { buildVoiceTaskMessage, type VoicePinResult } from '@/lib/today-priority-ranking';

const taskPriorities = ['high', 'medium', 'low'] as const;
const taskAssignees = ['Virgilio', 'Marco', 'Ida'] as const;
const taskWorkflowStatuses = ['active', 'waiting'] as const;

type TaskPortalProject = {
  id: string;
  name: string;
  status: string;
  description?: string;
  parent_project_id?: string | null;
  is_area?: boolean;
  sort_order?: number;
};

type VoiceTaskRpcResult = {
  task_id: string;
  is_today_priority: boolean;
  pin_result: VoicePinResult;
  replaced_task_text: string | null;
};

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

const assigneeNotePattern = /^\[\[responsabile:(.*?)\]\](?:\r?\n|$)/i;

function taskNotes(notes: string | undefined, assignee: string | undefined) {
  return [assignee ? `[[responsabile:${assignee}]]` : '', notes?.trim() ?? ''].filter(Boolean).join('\n\n');
}

function taskAssignee(notes: string | null | undefined) {
  return notes?.match(assigneeNotePattern)?.[1]?.trim() ?? null;
}

function visibleTaskNotes(notes: string | null | undefined) {
  return (notes ?? '').replace(assigneeNotePattern, '').trim();
}

function databaseError(action: string, error: { code?: string; message?: string; details?: string } | null) {
  const reference = [error?.code, error?.message, error?.details].filter(Boolean).join(' · ');
  return new Error(reference ? `${action} (${reference})` : action);
}

async function loadProjects() {
  const supabase = getVoiceServerClient();
  const richResult = await supabase
    .from('projects')
    .select('id, name, status, description, parent_project_id, is_area, sort_order')
    .neq('status', 'done')
    .order('sort_order')
    .order('name');

  if (!richResult.error) {
    return { projects: (richResult.data ?? []) as TaskPortalProject[], hierarchyAvailable: true };
  }

  // Some existing installations predate the Area -> Project migration. Keep
  // the connector useful while the idempotent database migration is applied.
  const legacyResult = await supabase
    .from('projects')
    .select('id, name, status')
    .neq('status', 'done')
    .order('name');
  if (legacyResult.error) throw databaseError('Non riesco a leggere i progetti.', legacyResult.error);
  return { projects: (legacyResult.data ?? []) as TaskPortalProject[], hierarchyAvailable: false };
}

async function resolveProject(projectName: string) {
  const { projects } = await loadProjects();
  const normalizedName = projectName.trim().toLocaleLowerCase('it');
  const matches = projects.filter(project =>
    !project.is_area && project.name.trim().toLocaleLowerCase('it') === normalizedName,
  );
  if (matches.length !== 1) {
    throw new Error(`Progetto non univoco o inesistente: ${projectName}. Usa list_projects e riprova con il nome esatto.`);
  }
  return matches[0];
}

function presentTask(task: Record<string, unknown>, projectNames: Map<string, string>) {
  const notes = typeof task.notes === 'string' ? task.notes : '';
  const projectId = typeof task.project_id === 'string' ? task.project_id : null;
  return {
    ...task,
    notes: visibleTaskNotes(notes) || null,
    assignee: taskAssignee(notes),
    project: projectId ? projectNames.get(projectId) ?? null : null,
  };
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
      const { projects, hierarchyAvailable } = await loadProjects();
      const areas = projects.filter(project => project.is_area);
      const areaNames = new Map(areas.map(area => [area.id, area.name]));
      return textResult({
        hierarchy_available: hierarchyAvailable,
        areas,
        projects: projects
          .filter(project => !project.is_area)
          .map(project => ({ ...project, area: project.parent_project_id ? areaNames.get(project.parent_project_id) ?? null : null })),
      });
    },
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'Leggi i task',
      description: 'Legge i task del Task Portal, opzionalmente filtrati per progetto, stato operativo o completamento.',
      inputSchema: {
        project_name: z.string().max(200).optional().describe('Nome esatto del progetto; ometti per leggere tutti i progetti.'),
        completion: z.enum(['open', 'completed', 'all']).default('open').describe('Mostra task aperti, completati o tutti.'),
        workflow_status: z.enum([...taskWorkflowStatuses, 'all']).default('all').describe('Filtra tra task attivi e in attesa.'),
        limit: z.number().int().min(1).max(200).default(100).describe('Numero massimo di task restituiti.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ project_name, completion, workflow_status, limit }) => {
      const supabase = getVoiceServerClient();
      const { projects } = await loadProjects();
      const projectNames = new Map(projects.map(project => [project.id, project.name]));
      const project = project_name ? await resolveProject(project_name) : null;
      const richResult = await supabase
        .from('tasks')
        .select('id, text, notes, project_id, priority, due_date, completed, workflow_status, is_today_priority, remind_at, created_at')
        .order('completed')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(limit);

      let rows: Record<string, unknown>[];
      let workflowAvailable = true;
      if (!richResult.error) {
        rows = (richResult.data ?? []) as Record<string, unknown>[];
      } else {
        const legacyResult = await supabase
          .from('tasks')
          .select('id, text, notes, project_id, priority, due_date, completed, created_at')
          .order('completed')
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(limit);
        if (legacyResult.error) throw databaseError('Non riesco a leggere i task.', legacyResult.error);
        rows = (legacyResult.data ?? []) as Record<string, unknown>[];
        workflowAvailable = false;
      }

      const filtered = rows.filter(task => {
        if (project && task.project_id !== project.id) return false;
        if (completion === 'open' && task.completed === true) return false;
        if (completion === 'completed' && task.completed !== true) return false;
        if (workflow_status !== 'all' && task.workflow_status !== workflow_status) return false;
        return true;
      });
      return textResult({ workflow_available: workflowAvailable, tasks: filtered.map(task => presentTask(task, projectNames)) });
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
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Scadenza ISO YYYY-MM-DD, solo se detta o concordata.'),
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
        const project = await resolveProject(project_name);
        projectId = project.id;
        resolvedProject = project.name;
      }
      const pinMode = force_pin ? 'force' : pin_today ? 'pin' : 'none';
      const { data, error } = await supabase.rpc('create_voice_task_with_priority_policy', {
        p_text: title.trim(), p_notes: taskNotes(notes, assignee), p_project_id: projectId, p_priority: priority,
        p_due_date: due_date ?? null, p_needs_review: false, p_pin_mode: pinMode,
      }).single();
      if (error || !data) throw databaseError('Non sono riuscito a creare il task.', error);
      const task = data as VoiceTaskRpcResult;
      return textResult({
        message: buildVoiceTaskMessage({ title: title.trim(), needsReview: false, pinResult: task.pin_result, replacedTaskText: task.replaced_task_text }),
        task: { id: task.task_id, title: title.trim(), notes: notes ?? null, priority, due_date: due_date ?? null, project: resolvedProject, assignee: assignee ?? null, is_today_priority: task.is_today_priority },
        today: romeDateKey(),
      });
    },
  );

  server.registerTool(
    'update_task',
    {
      title: 'Aggiorna un task',
      description: 'Aggiorna un task esistente. Usa list_tasks per ottenere prima il task_id corretto.',
      inputSchema: {
        task_id: z.string().uuid().describe('ID del task ottenuto da list_tasks.'),
        title: z.string().min(3).max(500).optional().describe('Nuovo titolo operativo.'),
        notes: z.string().max(4000).nullable().optional().describe('Nuove note; null le rimuove.'),
        priority: z.enum(taskPriorities).optional().describe('Nuova priorità.'),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('Nuova scadenza ISO; null la rimuove.'),
        project_name: z.string().max(200).nullable().optional().describe('Nome esatto del nuovo progetto; null sposta il task in Inbox.'),
        assignee: z.enum(taskAssignees).nullable().optional().describe('Nuovo responsabile; null lo rimuove.'),
        workflow_status: z.enum(taskWorkflowStatuses).optional().describe('Sposta il task tra attivo e in attesa.'),
        completed: z.boolean().optional().describe('Completa o riapre il task.'),
        pin_today: z.boolean().optional().describe('Fissa o rimuove il task dalle priorità di oggi.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ task_id, title, notes, priority, due_date, project_name, assignee, workflow_status, completed, pin_today }) => {
      const supabase = getVoiceServerClient();
      const { data: current, error: readError } = await supabase.from('tasks').select('id, notes').eq('id', task_id).maybeSingle();
      if (readError) throw databaseError('Non riesco a leggere il task da aggiornare.', readError);
      if (!current) throw new Error(`Task inesistente: ${task_id}.`);

      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.text = title.trim();
      if (priority !== undefined) updates.priority = priority;
      if (due_date !== undefined) updates.due_date = due_date;
      if (workflow_status !== undefined) updates.workflow_status = workflow_status;
      if (completed !== undefined) updates.completed = completed;
      if (pin_today !== undefined) updates.is_today_priority = pin_today;
      if (project_name !== undefined) updates.project_id = project_name === null ? null : (await resolveProject(project_name)).id;

      if (notes !== undefined || assignee !== undefined) {
        const nextNotes = notes === undefined ? visibleTaskNotes(current.notes) : notes ?? '';
        const nextAssignee = assignee === undefined ? taskAssignee(current.notes) ?? undefined : assignee ?? undefined;
        updates.notes = taskNotes(nextNotes, nextAssignee);
      }
      if (completed === true || workflow_status === 'waiting') updates.is_today_priority = false;
      if (Object.keys(updates).length === 0) throw new Error('Indica almeno un campo da aggiornare.');

      const { data, error } = await supabase.from('tasks').update(updates).eq('id', task_id).select('*').single();
      if (error || !data) throw databaseError('Non sono riuscito ad aggiornare il task.', error);
      const { projects } = await loadProjects();
      const projectNames = new Map(projects.map(project => [project.id, project.name]));
      return textResult({ task: presentTask(data as Record<string, unknown>, projectNames), today: romeDateKey() });
    },
  );

  return server;
}
