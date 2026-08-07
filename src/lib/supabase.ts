import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface Task {
  id: string;
  text: string;
  notes: string;
  project_id: string | null;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  category: 'work' | 'admin' | 'personal' | 'travel';
  completed: boolean;
  workflow_status: 'active' | 'waiting';
  remind_at: string | null;
  reminder_channel: 'telegram' | 'email';
  reminder_status: 'pending' | 'sent' | 'skipped';
  reminded_at: string | null;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'backlog' | 'active' | 'done';
  color: string;
  emoji: string;
  description: string;
  parent_project_id: string | null;
  is_area: boolean;
  sort_order: number;
}

type BackendMode = 'remote' | 'local';
type EntityType = 'task' | 'project';
type EntitySyncOperation = {
  entity: EntityType;
  type: 'upsert' | 'delete';
  id: string;
};

type ReorderSyncOperation = {
  entity: EntityType;
  type: 'reorder';
  ids: string[];
};

type SyncOperation = EntitySyncOperation | ReorderSyncOperation;

export interface SyncStatus {
  mode: BackendMode;
  pendingCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

const TASKS_KEY = 'switchboard.tasks';
const PROJECTS_KEY = 'switchboard.projects';
const SYNC_QUEUE_KEY = 'switchboard.sync-queue';
const SYNC_META_KEY = 'switchboard.sync-meta';
const TODAY_PRIORITIES_SEED_KEY = 'switchboard.today-priorities-seed-v1';

const defaultProjects: Project[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Master Carbon Farming',
    status: 'active',
    color: '#10b981',
    emoji: '🌱',
    description: 'Direttore Operativo - Universita della Tuscia',
    parent_project_id: null,
    is_area: false,
    sort_order: 0,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'SWITCH',
    status: 'active',
    color: '#3b82f6',
    emoji: '🇪🇺',
    description: 'Horizon Europe - Food Hub',
    parent_project_id: null,
    is_area: false,
    sort_order: 1,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'LIFE Food4Choice',
    status: 'active',
    color: '#f43f5e',
    emoji: '🍎',
    description: 'Progetto EU LIFE - App riconoscimento cibo',
    parent_project_id: null,
    is_area: false,
    sort_order: 2,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Terra Mia Tolfa',
    status: 'active',
    color: '#a855f7',
    emoji: '🏡',
    description: 'Valorizzazione territoriale Comune di Tolfa',
    parent_project_id: null,
    is_area: false,
    sort_order: 3,
  },
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Coach', status: 'active', color: '#f97316', emoji: '🤝', description: 'Sessioni di coaching', parent_project_id: null, is_area: false, sort_order: 4 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'FIB', status: 'active', color: '#ef4444', emoji: '🏦', description: 'Amministrazione FIB', parent_project_id: null, is_area: false, sort_order: 5 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', name: 'GAL', status: 'active', color: '#22c55e', emoji: '🧾', description: 'Fatturazione GAL', parent_project_id: null, is_area: false, sort_order: 6 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000004', name: 'WISE', status: 'active', color: '#06b6d4', emoji: '🔗', description: 'Integrazione dati e interfacce', parent_project_id: null, is_area: false, sort_order: 7 },
  { id: '88888888-8888-8888-8888-888888888888', name: 'Birra Peroni / BEST', status: 'active', color: '#eab308', emoji: '🍺', description: 'Manutenzione ed evoluzione BEST', parent_project_id: null, is_area: false, sort_order: 8 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000005', name: 'Nastro Azzurro', status: 'active', color: '#3b82f6', emoji: '🔵', description: 'Coordinamento Nastro Azzurro', parent_project_id: null, is_area: false, sort_order: 9 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000006', name: 'Scanner', status: 'active', color: '#64748b', emoji: '📦', description: 'Logistica scanner', parent_project_id: null, is_area: false, sort_order: 10 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000007', name: 'EFL', status: 'active', color: '#8b5cf6', emoji: '📊', description: 'Indicatori e caricamenti', parent_project_id: null, is_area: false, sort_order: 11 },
  { id: 'aaaaaaaa-0000-4000-8000-000000000008', name: 'VFF', status: 'active', color: '#ec4899', emoji: '📅', description: 'Coordinamento Value for Food', parent_project_id: null, is_area: false, sort_order: 12 },
];

function localDateKeyWithOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultTasks(): Task[] {
  const createdAt = nowIso();
  const base = {
    category: 'work' as const,
    completed: false,
    remind_at: null,
    reminder_channel: 'telegram' as const,
    reminder_status: 'pending' as const,
    reminded_at: null,
    created_at: createdAt,
  };

  return [
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000001', text: 'Rieseguire o verificare bonifico Coach (€400)', notes: 'Bonifico per 5 sessioni tentato e rifiutato.', project_id: 'aaaaaaaa-0000-4000-8000-000000000001', priority: 'high', due_date: localDateKeyWithOffset(0), workflow_status: 'active', sort_order: 0 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000002', text: 'Rieseguire o verificare il terzo bonifico FIB', notes: 'Due bonifici utili netti risultano eseguiti; il terzo è stato rifiutato.', project_id: 'aaaaaaaa-0000-4000-8000-000000000002', priority: 'high', due_date: localDateKeyWithOffset(0), workflow_status: 'active', sort_order: 1 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000003', text: 'Verificare emissione e invio della prima fattura GAL', notes: 'I dati necessari sono già stati inviati.', project_id: 'aaaaaaaa-0000-4000-8000-000000000003', priority: 'high', due_date: localDateKeyWithOffset(0), workflow_status: 'active', sort_order: 2 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000004', text: 'Riprendere integrazione dati e interfacce WISE con Giuseppe', notes: '[[responsabile:Virgilio + Giuseppe]]', project_id: 'aaaaaaaa-0000-4000-8000-000000000004', priority: 'medium', due_date: localDateKeyWithOffset(1), workflow_status: 'active', sort_order: 3 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000005', text: 'Chiarire suddivisione e invio file Peroni', notes: 'Ripresa prevista dal 25 agosto.', project_id: '88888888-8888-8888-8888-888888888888', priority: 'medium', due_date: '2026-08-25', workflow_status: 'waiting', sort_order: 4 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000006', text: 'Ottenere conferma e fissare allineamento Nastro Azzurro', notes: 'In attesa di conferma.', project_id: 'aaaaaaaa-0000-4000-8000-000000000005', priority: 'medium', due_date: null, workflow_status: 'waiting', sort_order: 5 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000007', text: 'Confermare destinazione e spedizione scanner', notes: '', project_id: 'aaaaaaaa-0000-4000-8000-000000000006', priority: 'medium', due_date: localDateKeyWithOffset(2), workflow_status: 'active', sort_order: 6 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000008', text: 'Allineare gli indicatori e provare il caricamento massivo EFL', notes: '', project_id: 'aaaaaaaa-0000-4000-8000-000000000007', priority: 'high', due_date: localDateKeyWithOffset(3), workflow_status: 'active', sort_order: 7 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000009', text: 'Chiudere accordo Confagricoltura e correggere le presenze', notes: '', project_id: '11111111-1111-1111-1111-111111111111', priority: 'high', due_date: localDateKeyWithOffset(4), workflow_status: 'active', sort_order: 8 },
    { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000010', text: 'Preparare e rispondere alla riunione VFF dell’8 settembre', notes: '', project_id: 'aaaaaaaa-0000-4000-8000-000000000008', priority: 'medium', due_date: '2026-09-08', workflow_status: 'active', sort_order: 9 },
  ];
}

const defaultSyncMeta = {
  lastSyncAt: null as string | null,
  lastSyncError: null as string | null,
};

let cachedMode: BackendMode | null = null;
let syncInFlight: Promise<boolean> | null = null;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocal<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return fallback;

  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureLocalSeeds() {
  if (!canUseLocalStorage()) return;

  if (!window.localStorage.getItem(PROJECTS_KEY)) {
    writeLocal(PROJECTS_KEY, defaultProjects);
  }

  if (!window.localStorage.getItem(TASKS_KEY)) {
    writeLocal<Task[]>(TASKS_KEY, getDefaultTasks());
  }

  if (!window.localStorage.getItem(SYNC_QUEUE_KEY)) {
    writeLocal<SyncOperation[]>(SYNC_QUEUE_KEY, []);
  }

  if (!window.localStorage.getItem(SYNC_META_KEY)) {
    writeLocal(SYNC_META_KEY, defaultSyncMeta);
  }

  // The browser-only demo receives the same initial priorities as the SQL
  // migration. Merge once by project name/task text and never reset user data.
  // Configured Supabase clients use migration_today_priorities.sql instead.
  if (!supabase && !window.localStorage.getItem(TODAY_PRIORITIES_SEED_KEY)) {
    const existingProjects = readLocal<Project[]>(PROJECTS_KEY, []);
    const knownProjectNames = new Set(existingProjects.map(project => project.name.trim().toLocaleLowerCase('it')));
    const mergedProjects = [
      ...existingProjects,
      ...defaultProjects.filter(project => !knownProjectNames.has(project.name.trim().toLocaleLowerCase('it'))),
    ];
    const projectIdByName = new Map(mergedProjects.map(project => [project.name.trim().toLocaleLowerCase('it'), project.id]));
    const seededProjectIdByName = new Map(defaultProjects.map(project => [project.id, project.name.trim().toLocaleLowerCase('it')]));

    const existingTasks = readLocal<Task[]>(TASKS_KEY, []);
    const knownTaskTexts = new Set(existingTasks.map(task => task.text.trim().toLocaleLowerCase('it')));
    const missingTasks = getDefaultTasks()
      .filter(task => !knownTaskTexts.has(task.text.trim().toLocaleLowerCase('it')))
      .map(task => {
        const projectName = task.project_id ? seededProjectIdByName.get(task.project_id) : undefined;
        return projectName ? { ...task, project_id: projectIdByName.get(projectName) ?? task.project_id } : task;
      });

    writeProjectsLocal(mergedProjects);
    writeTasksLocal([...existingTasks, ...missingTasks]);
    window.localStorage.setItem(TODAY_PRIORITIES_SEED_KEY, '1');
  }
}

function readTasksLocal() {
  ensureLocalSeeds();
  return readLocal<Task[]>(TASKS_KEY, []).map(normalizeTask);
}

function writeTasksLocal(tasks: Task[]) {
  writeLocal(TASKS_KEY, tasks);
}

function readProjectsLocal() {
  ensureLocalSeeds();
  return readLocal<Project[]>(PROJECTS_KEY, defaultProjects).map(normalizeProject);
}

function writeProjectsLocal(projects: Project[]) {
  writeLocal(PROJECTS_KEY, projects);
}

function readQueue() {
  ensureLocalSeeds();
  return readLocal<SyncOperation[]>(SYNC_QUEUE_KEY, []);
}

function writeQueue(queue: SyncOperation[]) {
  writeLocal(SYNC_QUEUE_KEY, queue);
}

function readSyncMeta() {
  ensureLocalSeeds();
  return readLocal(SYNC_META_KEY, defaultSyncMeta);
}

function writeSyncMeta(meta: typeof defaultSyncMeta) {
  writeLocal(SYNC_META_KEY, meta);
}

function setSyncMeta(patch: Partial<typeof defaultSyncMeta>) {
  writeSyncMeta({ ...readSyncMeta(), ...patch });
}

function nowIso() {
  return new Date().toISOString();
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
}

function sortTasks(tasks: Task[]) {
  return [...tasks].map(normalizeTask).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function sortProjects(projects: Project[]) {
  return [...projects].map(normalizeProject).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeProject(project: Partial<Project>): Project {
  return {
    id: project.id ?? '',
    name: project.name ?? '',
    status: project.status ?? 'backlog',
    color: project.color ?? '#3b82f6',
    emoji: project.emoji ?? '📁',
    description: project.description ?? '',
    parent_project_id: project.parent_project_id ?? null,
    is_area: project.is_area ?? false,
    sort_order: project.sort_order ?? 0,
  };
}

async function detectBackendMode(forceRefresh = false): Promise<BackendMode> {
  if (cachedMode && !forceRefresh) return cachedMode;

  if (!supabase || !supabaseUrl) {
    cachedMode = 'local';
    return cachedMode;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/tasks?select=id&limit=1`, {
      headers: {
        apikey: supabaseAnonKey ?? '',
        Authorization: `Bearer ${supabaseAnonKey ?? ''}`,
      },
    });

    cachedMode = response.ok ? 'remote' : 'local';
  } catch {
    cachedMode = 'local';
  }

  return cachedMode;
}

function setLocalMode() {
  cachedMode = 'local';
}

function setRemoteMode() {
  cachedMode = 'remote';
}

function queueOperation(operation: SyncOperation) {
  const queue = readQueue();
  if (operation.type === 'reorder') {
    const mergedIds = new Set(operation.ids);
    const withoutPreviousReorders = queue.filter((queued) => {
      if (queued.type !== 'reorder' || queued.entity !== operation.entity) return true;
      queued.ids.forEach((id) => mergedIds.add(id));
      return false;
    });
    writeQueue([...withoutPreviousReorders, { ...operation, ids: [...mergedIds] }]);
    return;
  }

  const compacted = queue
    .filter((queued) => queued.type === 'reorder' || queued.entity !== operation.entity || queued.id !== operation.id)
    .map((queued) => {
      if (operation.type !== 'delete' || queued.type !== 'reorder' || queued.entity !== operation.entity) return queued;
      return { ...queued, ids: queued.ids.filter((id) => id !== operation.id) };
    })
    .filter((queued) => queued.type !== 'reorder' || queued.ids.length > 0);
  writeQueue([...compacted, operation]);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Sync fallita';
}

function normalizeTask(task: Partial<Task>): Task {
  return {
    id: task.id ?? '',
    text: task.text ?? '',
    notes: task.notes ?? '',
    project_id: task.project_id ?? null,
    priority: task.priority ?? 'medium',
    due_date: task.due_date ?? null,
    category: task.category ?? 'work',
    completed: task.completed ?? false,
    workflow_status: task.workflow_status ?? 'active',
    remind_at: task.remind_at ?? null,
    reminder_channel: task.reminder_channel ?? 'telegram',
    reminder_status: task.reminder_status ?? 'pending',
    reminded_at: task.reminded_at ?? null,
    sort_order: task.sort_order ?? 0,
    created_at: task.created_at ?? nowIso(),
  };
}

function replaceTaskLocal(task: Task) {
  const tasks = readTasksLocal();
  writeTasksLocal([normalizeTask(task), ...tasks.filter((item) => item.id !== task.id)]);
}

function replaceProjectLocal(project: Project) {
  const projects = readProjectsLocal();
  writeProjectsLocal([...projects.filter((item) => item.id !== project.id), normalizeProject(project)]);
}

function deleteTaskLocal(id: string) {
  writeTasksLocal(readTasksLocal().filter((task) => task.id !== id));
}

async function loadRemoteTasks() {
  const { data, error } = await supabase!
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
    return (data || []).map(normalizeTask);
}

async function loadRemoteProjects() {
  const { data, error } = await supabase!
    .from('projects')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []).map(normalizeProject);
}

export async function getBackendMode(): Promise<BackendMode> {
  return detectBackendMode();
}

export function getSyncStatus(): SyncStatus {
  const meta = readSyncMeta();
  return {
    mode: cachedMode ?? 'local',
    pendingCount: readQueue().length,
    syncing: syncInFlight !== null,
    lastSyncAt: meta.lastSyncAt,
    lastSyncError: meta.lastSyncError,
  };
}

export async function syncPendingChanges(): Promise<boolean> {
  if (!canUseLocalStorage()) return false;

  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const mode = await detectBackendMode(true);
    if (mode !== 'remote' || !supabase) {
      setLocalMode();
      setSyncMeta({
        lastSyncError: supabase
          ? 'Supabase non raggiungibile. Riprova tra poco.'
          : 'Configurazione Supabase mancante.',
      });
      return false;
    }

    const queue = readQueue();
    if (queue.length === 0) {
      setRemoteMode();
      setSyncMeta({ lastSyncError: null, lastSyncAt: nowIso() });
      return true;
    }

    try {
      const taskUpsertIds = new Set<string>();
      const taskDeleteIds = new Set<string>();
      const projectUpsertIds = new Set<string>();
      const projectDeleteIds = new Set<string>();

      for (const operation of queue) {
        const upserts = operation.entity === 'task' ? taskUpsertIds : projectUpsertIds;
        const deletes = operation.entity === 'task' ? taskDeleteIds : projectDeleteIds;
        if (operation.type === 'reorder') {
          operation.ids.forEach((id) => {
            if (!deletes.has(id)) upserts.add(id);
          });
        } else if (operation.type === 'delete') {
          upserts.delete(operation.id);
          deletes.add(operation.id);
        } else {
          deletes.delete(operation.id);
          upserts.add(operation.id);
        }
      }

      let tasks = readTasksLocal();
      let projects = readProjectsLocal();

      // Repair queues created by older versions: detach every reference before
      // deleting a project, regardless of the database constraint configuration.
      if (projectDeleteIds.size > 0) {
        tasks = tasks.map((task) => projectDeleteIds.has(task.project_id ?? '') ? { ...task, project_id: null } : task);
        projects = projects.map((project) => projectDeleteIds.has(project.parent_project_id ?? '') ? { ...project, parent_project_id: null } : project);
        writeTasksLocal(tasks);
        writeProjectsLocal(projects);
      }

      const projectsToUpsert = projects.filter((project) => projectUpsertIds.has(project.id) && !projectDeleteIds.has(project.id));
      if (projectsToUpsert.length > 0) {
        const { error } = await supabase.from('projects').upsert(projectsToUpsert, { onConflict: 'id' });
        if (error) throw error;
      }

      const tasksToUpsert = tasks.filter((task) => taskUpsertIds.has(task.id) && !taskDeleteIds.has(task.id));
      if (tasksToUpsert.length > 0) {
        const { error } = await supabase.from('tasks').upsert(tasksToUpsert, { onConflict: 'id' });
        if (error) throw error;
      }

      if (taskDeleteIds.size > 0) {
        const { error } = await supabase.from('tasks').delete().in('id', [...taskDeleteIds]);
        if (error) throw error;
      }

      if (projectDeleteIds.size > 0) {
        const deletedIds = [...projectDeleteIds];
        const { error: taskReferenceError } = await supabase.from('tasks').update({ project_id: null }).in('project_id', deletedIds);
        if (taskReferenceError) throw taskReferenceError;
        const { error: projectReferenceError } = await supabase.from('projects').update({ parent_project_id: null }).in('parent_project_id', deletedIds);
        if (projectReferenceError) throw projectReferenceError;
        const { error: projectDeleteError } = await supabase.from('projects').delete().in('id', deletedIds);
        if (projectDeleteError) throw projectDeleteError;
      }

      const [remoteTasks, remoteProjects] = await Promise.all([
        loadRemoteTasks(),
        loadRemoteProjects(),
      ]);

      writeTasksLocal(sortTasks(remoteTasks));
      writeProjectsLocal(sortProjects(remoteProjects));
      writeQueue([]);
      setRemoteMode();
      setSyncMeta({ lastSyncError: null, lastSyncAt: nowIso() });
      return true;
    } catch (error) {
      console.error('Error syncing pending changes:', error);
      setLocalMode();
      setSyncMeta({
        lastSyncError: errorMessage(error),
      });
      return false;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

export async function getTasks(): Promise<Task[]> {
  const mode = await detectBackendMode();
  if (mode === 'local') {
    return sortTasks(readTasksLocal());
  }

  try {
    const data = await loadRemoteTasks();
    writeTasksLocal(sortTasks(data));
    return data;
  } catch (error) {
    console.error('Error fetching tasks, falling back to local mode:', error);
    setLocalMode();
    return sortTasks(readTasksLocal());
  }
}

export async function getProjects(): Promise<Project[]> {
  const mode = await detectBackendMode();
  if (mode === 'local') {
    return sortProjects(readProjectsLocal());
  }

  try {
    const data = await loadRemoteProjects();
    writeProjectsLocal(sortProjects(data));
    return data;
  } catch (error) {
    console.error('Error fetching projects, falling back to local mode:', error);
    setLocalMode();
    return sortProjects(readProjectsLocal());
  }
}

export async function addTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task | null> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    const newTask: Task = normalizeTask({ ...task, id: makeId(), created_at: nowIso() });
    replaceTaskLocal(newTask);
    queueOperation({ entity: 'task', type: 'upsert', id: newTask.id });
    return newTask;
  }

  try {
    const { data, error } = await supabase!
      .from('tasks')
      .insert([task])
      .select()
      .single();

    if (error) throw error;
    replaceTaskLocal(normalizeTask(data));
    return normalizeTask(data);
  } catch (error) {
    console.error('Error adding task, falling back to local mode:', error);
    setLocalMode();
    return addTask(task);
  }
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    const current = readTasksLocal().find((task) => task.id === id);
    if (!current) return null;

    const updated = normalizeTask({ ...current, ...updates });
    replaceTaskLocal(updated);
    queueOperation({ entity: 'task', type: 'upsert', id });
    return updated;
  }

  try {
    const { data, error } = await supabase!
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    replaceTaskLocal(normalizeTask(data));
    return normalizeTask(data);
  } catch (error) {
    console.error('Error updating task, falling back to local mode:', error);
    setLocalMode();
    return updateTask(id, updates);
  }
}

export async function updateTaskOrder(updates: Array<Pick<Task, 'id' | 'sort_order'>>): Promise<Task[]> {
  if (updates.length === 0) return [];

  const positions = new Map(updates.map((update) => [update.id, update.sort_order]));
  const reorderedTasks = readTasksLocal().map((task) => {
    const sortOrder = positions.get(task.id);
    return sortOrder === undefined ? task : normalizeTask({ ...task, sort_order: sortOrder });
  });
  const changedTasks = reorderedTasks.filter((task) => positions.has(task.id));
  writeTasksLocal(reorderedTasks);

  const mode = await detectBackendMode();
  if (mode === 'local') {
    queueOperation({ entity: 'task', type: 'reorder', ids: changedTasks.map((task) => task.id) });
    return changedTasks;
  }

  try {
    const { error } = await supabase!.from('tasks').upsert(changedTasks, { onConflict: 'id' });
    if (error) throw error;
    return changedTasks;
  } catch (error) {
    console.error('Error reordering tasks, falling back to local mode:', error);
    setLocalMode();
    queueOperation({ entity: 'task', type: 'reorder', ids: changedTasks.map((task) => task.id) });
    return changedTasks;
  }
}

export async function deleteTask(id: string): Promise<boolean> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    deleteTaskLocal(id);
    queueOperation({ entity: 'task', type: 'delete', id });
    return true;
  }

  try {
    const { error } = await supabase!.from('tasks').delete().eq('id', id);
    if (error) throw error;
    deleteTaskLocal(id);
    return true;
  } catch (error) {
    console.error('Error deleting task, falling back to local mode:', error);
    setLocalMode();
    return deleteTask(id);
  }
}

export async function addProject(project: Omit<Project, 'id'>): Promise<Project | null> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    const newProject: Project = normalizeProject({ ...project, id: makeId() });
    replaceProjectLocal(newProject);
    queueOperation({ entity: 'project', type: 'upsert', id: newProject.id });
    return newProject;
  }

  try {
    const { data, error } = await supabase!
      .from('projects')
      .insert([project])
      .select()
      .single();

    if (error) throw error;
    replaceProjectLocal(normalizeProject(data));
    return normalizeProject(data);
  } catch (error) {
    console.error('Error adding project, falling back to local mode:', error);
    setLocalMode();
    return addProject(project);
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    writeTasksLocal(readTasksLocal().map((task) => task.project_id === id ? { ...task, project_id: null } : task));
    writeProjectsLocal(
      readProjectsLocal()
        .map((project) => project.parent_project_id === id ? { ...project, parent_project_id: null } : project)
        .filter((project) => project.id !== id),
    );
    queueOperation({ entity: 'project', type: 'delete', id });
    return true;
  }

  try {
    const { error: taskReferenceError } = await supabase!.from('tasks').update({ project_id: null }).eq('project_id', id);
    if (taskReferenceError) throw taskReferenceError;
    const { error: projectReferenceError } = await supabase!.from('projects').update({ parent_project_id: null }).eq('parent_project_id', id);
    if (projectReferenceError) throw projectReferenceError;
    const { error: projectDeleteError } = await supabase!.from('projects').delete().eq('id', id);
    if (projectDeleteError) throw projectDeleteError;
    writeTasksLocal(readTasksLocal().map((task) => task.project_id === id ? { ...task, project_id: null } : task));
    writeProjectsLocal(
      readProjectsLocal()
        .map((project) => project.parent_project_id === id ? { ...project, parent_project_id: null } : project)
        .filter((project) => project.id !== id),
    );
    return true;
  } catch (error) {
    console.error('Error deleting project, falling back to local mode:', error);
    setLocalMode();
    return deleteProject(id);
  }
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    const current = readProjectsLocal().find((project) => project.id === id);
    if (!current) return null;

    const updated = normalizeProject({ ...current, ...updates });
    replaceProjectLocal(updated);
    queueOperation({ entity: 'project', type: 'upsert', id });
    return updated;
  }

  try {
    const { data, error } = await supabase!
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    replaceProjectLocal(normalizeProject(data));
    return normalizeProject(data);
  } catch (error) {
    console.error('Error updating project, falling back to local mode:', error);
    setLocalMode();
    return updateProject(id, updates);
  }
}

export async function updateProjectOrder(
  updates: Array<Pick<Project, 'id' | 'parent_project_id' | 'sort_order'>>,
): Promise<Project[]> {
  if (updates.length === 0) return [];

  const positions = new Map(updates.map((update) => [update.id, update]));
  const reorderedProjects = readProjectsLocal().map((project) => {
    const update = positions.get(project.id);
    return update ? normalizeProject({ ...project, ...update }) : project;
  });
  const changedProjects = reorderedProjects.filter((project) => positions.has(project.id));
  writeProjectsLocal(reorderedProjects);

  const mode = await detectBackendMode();
  if (mode === 'local') {
    queueOperation({ entity: 'project', type: 'reorder', ids: changedProjects.map((project) => project.id) });
    return changedProjects;
  }

  try {
    const { error } = await supabase!.from('projects').upsert(changedProjects, { onConflict: 'id' });
    if (error) throw error;
    return changedProjects;
  } catch (error) {
    console.error('Error reordering projects, falling back to local mode:', error);
    setLocalMode();
    queueOperation({ entity: 'project', type: 'reorder', ids: changedProjects.map((project) => project.id) });
    return changedProjects;
  }
}
