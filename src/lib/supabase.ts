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
  remind_at: string | null;
  reminder_channel: 'telegram' | 'email';
  reminder_status: 'pending' | 'sent' | 'skipped';
  reminded_at: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'backlog' | 'active' | 'done';
  color: string;
  emoji: string;
  description: string;
}

type BackendMode = 'remote' | 'local';
type EntityType = 'task' | 'project';
type SyncOperationType = 'upsert' | 'delete';

interface SyncOperation {
  entity: EntityType;
  type: SyncOperationType;
  id: string;
}

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

const defaultProjects: Project[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Master Carbon Farming',
    status: 'active',
    color: '#10b981',
    emoji: '🌱',
    description: 'Direttore Operativo - Universita della Tuscia',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'SWITCH',
    status: 'active',
    color: '#3b82f6',
    emoji: '🇪🇺',
    description: 'Horizon Europe - Food Hub',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'LIFE Food4Choice',
    status: 'active',
    color: '#f43f5e',
    emoji: '🍎',
    description: 'Progetto EU LIFE - App riconoscimento cibo',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Terra Mia Tolfa',
    status: 'active',
    color: '#a855f7',
    emoji: '🏡',
    description: 'Valorizzazione territoriale Comune di Tolfa',
  },
];

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
    writeLocal<Task[]>(TASKS_KEY, []);
  }

  if (!window.localStorage.getItem(SYNC_QUEUE_KEY)) {
    writeLocal<SyncOperation[]>(SYNC_QUEUE_KEY, []);
  }

  if (!window.localStorage.getItem(SYNC_META_KEY)) {
    writeLocal(SYNC_META_KEY, defaultSyncMeta);
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
  return readLocal<Project[]>(PROJECTS_KEY, defaultProjects);
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
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}

async function detectBackendMode(forceRefresh = false): Promise<BackendMode> {
  if (cachedMode && !forceRefresh) return cachedMode;

  if (!supabase || !supabaseUrl) {
    cachedMode = 'local';
    return cachedMode;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
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
  writeQueue([...queue, operation]);
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
    remind_at: task.remind_at ?? null,
    reminder_channel: task.reminder_channel ?? 'telegram',
    reminder_status: task.reminder_status ?? 'pending',
    reminded_at: task.reminded_at ?? null,
    created_at: task.created_at ?? nowIso(),
  };
}

function replaceTaskLocal(task: Task) {
  const tasks = readTasksLocal();
  writeTasksLocal([normalizeTask(task), ...tasks.filter((item) => item.id !== task.id)]);
}

function replaceProjectLocal(project: Project) {
  const projects = readProjectsLocal();
  writeProjectsLocal([...projects.filter((item) => item.id !== project.id), project]);
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
  return data || [];
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
      return false;
    }

    const queue = readQueue();
    if (queue.length === 0) {
      setRemoteMode();
      setSyncMeta({ lastSyncError: null, lastSyncAt: nowIso() });
      return true;
    }

    try {
      const tasks = readTasksLocal();
      const projects = readProjectsLocal();

      for (const operation of queue) {
        if (operation.entity === 'task') {
          if (operation.type === 'delete') {
            const { error } = await supabase.from('tasks').delete().eq('id', operation.id);
            if (error) throw error;
          } else {
            const task = tasks.find((item) => item.id === operation.id);
            if (!task) continue;
            const { error } = await supabase.from('tasks').upsert(task, { onConflict: 'id' });
            if (error) throw error;
          }
        } else {
          if (operation.type === 'delete') {
            const { error } = await supabase.from('projects').delete().eq('id', operation.id);
            if (error) throw error;
          } else {
            const project = projects.find((item) => item.id === operation.id);
            if (!project) continue;
            const { error } = await supabase.from('projects').upsert(project, { onConflict: 'id' });
            if (error) throw error;
          }
        }
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
        lastSyncError: error instanceof Error ? error.message : 'Sync fallita',
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
    const newProject: Project = { ...project, id: makeId() };
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
    replaceProjectLocal(data);
    return data;
  } catch (error) {
    console.error('Error adding project, falling back to local mode:', error);
    setLocalMode();
    return addProject(project);
  }
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const mode = await detectBackendMode();

  if (mode === 'local') {
    const current = readProjectsLocal().find((project) => project.id === id);
    if (!current) return null;

    const updated = { ...current, ...updates };
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
    replaceProjectLocal(data);
    return data;
  } catch (error) {
    console.error('Error updating project, falling back to local mode:', error);
    setLocalMode();
    return updateProject(id, updates);
  }
}
