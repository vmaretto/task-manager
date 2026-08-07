'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Task,
  Project,
  addTask,
  getBackendMode,
  getProjects,
  getSyncStatus,
  getTasks,
  updateTask,
} from '../../lib/supabase';

type QuickMode = 'normal' | 'priority';
type ViewerProfile = 'virgilio' | 'marco' | 'ida';

const QUICK_ADD_URL = 'https://task-manager-dusky-chi-88.vercel.app/quick-add';
const viewerLabels: Record<ViewerProfile, string> = {
  virgilio: 'Virgilio',
  marco: 'Marco',
  ida: 'Ida',
};

function assigneeNotes(assignee: string) {
  return assignee ? `[[responsabile:${assignee}]]` : '';
}

function localDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function QuickAddPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<QuickMode>('normal');
  const [text, setText] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('Virgilio');
  const [backendMode, setBackendMode] = useState<'remote' | 'local'>('remote');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  const pinnedTasks = useMemo(
    () => tasks.filter(task => !task.completed && task.workflow_status === 'active' && task.is_today_priority),
    [tasks],
  );
  const priorityLimitReached = pinnedTasks.length >= 3;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedProfile = new URLSearchParams(window.location.search).get('profilo')
        ?? window.localStorage.getItem('switchboard.viewer-profile');
      if (requestedProfile === 'virgilio' || requestedProfile === 'marco' || requestedProfile === 'ida') {
        setAssignee(viewerLabels[requestedProfile]);
      }

      void Promise.all([getTasks(), getProjects(), getBackendMode()])
        .then(([taskData, projectData, currentBackendMode]) => {
          setTasks(taskData);
          setProjects(projectData.filter(project => !project.is_area && project.status !== 'done'));
          setBackendMode(currentBackendMode);
        })
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectMode = (nextMode: QuickMode) => {
    setMessage(null);
    if (nextMode === 'priority' && priorityLimitReached) {
      setMode('priority');
      setMessage({ tone: 'error', text: 'Hai già fissato 3 attività. Rimuovine una qui sotto prima di crearne un’altra.' });
      return;
    }
    setMode(nextMode);
  };

  const unpinTask = async (taskId: string) => {
    const updated = await updateTask(taskId, { is_today_priority: false });
    if (!updated) {
      setMessage({ tone: 'error', text: 'Non sono riuscito a liberare il posto. Controlla la connessione e riprova.' });
      return;
    }
    setTasks(previous => previous.map(task => task.id === taskId ? updated : task));
    setMessage({ tone: 'success', text: 'Posto liberato. Ora puoi creare una nuova priorità.' });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || saving) return;
    if (mode === 'priority' && priorityLimitReached) {
      setMessage({ tone: 'error', text: 'Prima rimuovi una delle tre attività già fissate.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const siblingTasks = tasks.filter(task => task.project_id === (projectId || null));
    const newTask = await addTask({
      text: cleanText,
      notes: assigneeNotes(assignee),
      project_id: projectId || null,
      priority: mode === 'priority' ? 'high' : 'medium',
      due_date: dueDate || null,
      category: 'work',
      completed: false,
      workflow_status: 'active',
      is_today_priority: mode === 'priority',
      remind_at: null,
      reminder_channel: 'telegram',
      reminder_status: 'pending',
      reminded_at: null,
      sort_order: siblingTasks.length ? Math.max(...siblingTasks.map(task => task.sort_order)) + 1 : 0,
    });

    setSaving(false);
    if (!newTask) {
      setMessage({ tone: 'error', text: 'Il task non è stato creato. Controlla la connessione e riprova.' });
      return;
    }

    setTasks(previous => [newTask, ...previous]);
    setBackendMode(getSyncStatus().mode);
    setText('');
    setMessage({
      tone: 'success',
      text: mode === 'priority' ? 'Priorità creata e fissata nella dashboard.' : 'Task creato.',
    });
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(QUICK_ADD_URL);
    setMessage({ tone: 'success', text: 'URL copiato.' });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#164e63_0,transparent_34%),linear-gradient(180deg,#0f172a,#020617)] px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-3 py-3">
          <Link href="/" className="rounded-xl border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-semibold text-slate-200">← Dashboard</Link>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${backendMode === 'remote' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
            {backendMode === 'remote' ? '● Supabase' : '● Offline · sincronizza dopo'}
          </span>
        </header>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/85 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="border-b border-slate-700 bg-gradient-to-br from-cyan-500/15 via-transparent to-rose-500/10 p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Aggiunta rapida</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Cattura e torna a fare.</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Scrivi l’attività, scegli se è normale o prioritaria e salva.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-7">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-300">Modalità</legend>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/50 p-1.5">
                <button
                  type="button"
                  onClick={() => selectMode('normal')}
                  className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === 'normal' ? 'bg-slate-700 text-white shadow' : 'text-slate-400'}`}
                >
                  ✓ Task normale
                </button>
                <button
                  type="button"
                  onClick={() => selectMode('priority')}
                  className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === 'priority' ? 'bg-rose-500 text-white shadow-lg shadow-rose-950/30' : 'text-slate-400'}`}
                >
                  📌 Priorità di oggi
                </button>
              </div>
              {mode === 'priority' && (
                <p className="mt-2 text-xs leading-relaxed text-rose-100/80">Verrà creata con priorità alta e fissata in uno dei tre posti principali.</p>
              )}
            </fieldset>

            <div>
              <label htmlFor="quick-task" className="mb-2 block text-sm font-semibold text-slate-200">Cosa devi fare?</label>
              <textarea
                id="quick-task"
                value={text}
                onChange={event => setText(event.target.value)}
                placeholder="Es. Richiamare Giuseppe per WISE"
                rows={3}
                autoFocus
                className="w-full resize-none rounded-2xl border-2 border-slate-600 bg-slate-800 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </div>

            <details className="rounded-2xl border border-slate-700 bg-slate-950/35">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">Opzioni rapide · progetto, data, responsabile</summary>
              <div className="grid gap-4 border-t border-slate-700 p-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-400">Progetto
                  <select value={projectId} onChange={event => setProjectId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white">
                    <option value="">Nessun progetto</option>
                    {projects.map(project => <option key={project.id} value={project.id}>{project.emoji} {project.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-400">Scadenza
                  <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} min={localDateKey()} className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white" />
                </label>
                <label className="text-xs font-semibold text-slate-400 sm:col-span-2">Responsabile
                  <select value={assignee} onChange={event => setAssignee(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white">
                    <option>Virgilio</option>
                    <option>Marco</option>
                    <option>Ida</option>
                    <option>Virgilio + Marco</option>
                    <option>Virgilio + Ida</option>
                    <option>Marco + Ida</option>
                    <option>Virgilio + Marco + Ida</option>
                  </select>
                </label>
              </div>
            </details>

            {message && (
              <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
                {message.text}
              </div>
            )}

            {mode === 'priority' && priorityLimitReached && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-bold text-amber-100">I 3 posti sono già occupati</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/75">Scegli quale attività non deve più restare fissata. Il task rimarrà comunque aperto.</p>
                <div className="mt-3 space-y-2">
                  {pinnedTasks.slice(0, 3).map(task => (
                    <div key={task.id} className="flex items-center gap-2 rounded-xl bg-slate-950/35 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{task.text}</span>
                      <button type="button" onClick={() => void unpinTask(task.id)} className="shrink-0 rounded-lg border border-slate-500 px-2.5 py-1.5 text-xs font-semibold text-white">Rimuovi</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || saving || !text.trim() || (mode === 'priority' && priorityLimitReached)}
              className={`w-full rounded-2xl px-5 py-4 text-base font-bold shadow-xl transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'priority' ? 'bg-rose-500 text-white shadow-rose-950/30' : 'bg-cyan-500 text-slate-950 shadow-cyan-950/30'}`}
            >
              {saving ? 'Salvataggio…' : mode === 'priority' ? '📌 Crea e fissa priorità' : '＋ Crea task'}
            </button>
          </form>
        </section>

        <section className="mt-5 rounded-3xl border border-slate-700 bg-slate-900/75 p-5 sm:p-6">
          <button type="button" onClick={() => setGuideOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left">
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-violet-300">iPhone</span>
              <span className="mt-1 block text-xl font-bold">Configura tasto Azione iPhone</span>
            </span>
            <span className="text-xl text-slate-400">{guideOpen ? '−' : '+'}</span>
          </button>

          {guideOpen && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <ol className="space-y-3 text-sm leading-relaxed text-slate-300">
                <li><strong className="text-white">1.</strong> Apri questa pagina una volta in Safari ed effettua il normale accesso, se richiesto.</li>
                <li><strong className="text-white">2.</strong> Nell’app <strong className="text-white">Comandi Rapidi</strong>, crea un nuovo comando e aggiungi l’azione <strong className="text-white">Apri URL</strong>.</li>
                <li><strong className="text-white">3.</strong> Inserisci l’indirizzo qui sotto e chiama il comando “Aggiunta rapida task”.</li>
                <li><strong className="text-white">4.</strong> Vai in <strong className="text-white">Impostazioni → Tasto Azione → Comando rapido</strong>, tocca “Scegli comando rapido” e seleziona quello appena creato.</li>
              </ol>
              <div className="mt-4 rounded-xl border border-slate-600 bg-slate-950/50 p-3">
                <code className="block break-all text-xs text-cyan-200">{QUICK_ADD_URL}</code>
                <button type="button" onClick={() => void copyUrl()} className="mt-3 w-full rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">Copia URL</button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">Il tasto apre una normale pagina HTTPS dell’app: non installa profili e non usa integrazioni iOS proprietarie.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
