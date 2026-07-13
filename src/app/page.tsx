'use client';

import { useState, useEffect } from 'react';
import CanvasView from './CanvasView';
import { Task, Project, getTasks, getProjects, addTask, updateTask, deleteTask, addProject, updateProject, deleteProject, getBackendMode, getSyncStatus, syncPendingChanges } from '../lib/supabase';

// ============================================
// COMPONENTS
// ============================================

const reminderStatusLabel = {
  pending: 'Programmato',
  sent: 'Inviato',
  skipped: 'Saltato',
};

function formatReminderDate(value: string) {
  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function QuickCapture({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="➕ Aggiungi task veloce..."
          className="flex-1 bg-slate-800 border-2 border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors shadow-lg"
        >
          Aggiungi
        </button>
      </div>
    </form>
  );
}

function TaskItem({ 
  task, 
  projects,
  onToggle, 
  onDelete,
  onEdit
}: { 
  task: Task; 
  projects: Project[];
  onToggle: () => void | Promise<void>; 
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const project = projects.find(p => p.id === task.project_id);
  
  const priorityColors = {
    high: 'bg-red-500/30 text-red-300 border-red-500/50',
    medium: 'bg-amber-500/30 text-amber-300 border-amber-500/50',
    low: 'bg-slate-500/30 text-slate-300 border-slate-500/50',
  };

  const categoryEmoji = {
    work: '💼',
    admin: '📋',
    personal: '👤',
    travel: '✈️',
  };

  const handleToggle = async () => {
    if (isToggling) return; // Prevent double-clicks
    setIsToggling(true);
    await onToggle();
    setIsToggling(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('application/task-id', task.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={`bg-slate-800 rounded-xl p-4 border-2 ${task.completed ? 'opacity-50 border-slate-700' : 'border-slate-600'} shadow-lg cursor-grab active:cursor-grabbing`}>
      <div className="flex items-start gap-3">
        {/* Larger tap target wrapper */}
        <div 
          onClick={handleToggle}
          className="p-2 -m-2 cursor-pointer flex-shrink-0"
        >
          <div
            className={`w-8 h-8 rounded-lg border-3 flex items-center justify-center transition-all ${
              isToggling 
                ? 'bg-yellow-500 border-yellow-500 animate-pulse'
                : task.completed 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : 'border-white border-2 bg-transparent hover:border-green-400 hover:bg-green-500/20 active:bg-green-500/40'
            }`}
          >
            {isToggling ? (
              <span className="text-lg">⏳</span>
            ) : task.completed ? (
              <span className="text-lg font-bold">✓</span>
            ) : null}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`text-white font-medium ${task.completed ? 'line-through text-slate-500' : ''}`}>
            {task.text}
          </div>
          
          {task.notes && (
            <div className="text-sm text-slate-400 mt-1 italic">
              📝 {task.notes}
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-sm">{categoryEmoji[task.category]}</span>
            
            <span className={`text-xs px-2 py-1 rounded-md border font-medium ${priorityColors[task.priority]}`}>
              {task.priority === 'high' ? '🔴 Alta' : task.priority === 'medium' ? '🟡 Media' : '⚪ Bassa'}
            </span>
            
            {project && (
              <span 
                className="text-xs px-2 py-1 rounded-md font-medium"
                style={{ backgroundColor: `${project.color}30`, color: project.color, border: `1px solid ${project.color}60` }}
              >
                {project.emoji} {project.name}
              </span>
            )}
            
            {task.due_date && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-md">
                📅 {new Date(task.due_date).toLocaleDateString('it-IT')}
              </span>
            )}

            {task.remind_at && (
              <span className="text-xs text-cyan-200 bg-cyan-500/15 border border-cyan-500/30 px-2 py-1 rounded-md">
                ⏰ {formatReminderDate(task.remind_at)} · {reminderStatusLabel[task.reminder_status]}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 p-2 rounded-lg transition-colors"
            title="Modifica"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 rounded-lg transition-colors"
            title="Elimina"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  status,
  projects,
  onMoveProject,
  onSelectProject,
  onEditProject,
  selectedProjectId
}: {
  title: string;
  status: 'backlog' | 'active' | 'done';
  projects: Project[];
  onMoveProject: (projectId: string, newStatus: 'backlog' | 'active' | 'done') => void;
  onSelectProject: (projectId: string | null) => void;
  onEditProject: (project: Project) => void;
  selectedProjectId: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const columnProjects = projects.filter(p => p.status === status);

  const statusColors = {
    backlog: 'border-slate-600 bg-slate-800/50',
    active: 'border-amber-500/50 bg-amber-500/10',
    done: 'border-green-500/50 bg-green-500/10',
  };

  const dragOverColors = {
    backlog: 'border-slate-400 bg-slate-700/70',
    active: 'border-amber-400 bg-amber-500/20',
    done: 'border-green-400 bg-green-500/20',
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 min-h-[200px] transition-colors ${dragOver ? dragOverColors[status] : statusColors[status]}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const projectId = e.dataTransfer.getData('text/plain');
        if (projectId) onMoveProject(projectId, status);
      }}
    >
      <h3 className="font-bold text-sm uppercase tracking-wide text-slate-300 mb-3">
        {title} ({columnProjects.length})
      </h3>

      <div className="space-y-2">
        {columnProjects.map(project => (
          <div
            key={project.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', project.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
            className={`p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all ${
              selectedProjectId === project.id
                ? 'ring-2 ring-white bg-slate-700'
                : 'bg-slate-700/50 hover:bg-slate-700'
            }`}
            style={{ borderLeft: `4px solid ${project.color}` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{project.emoji}</span>
                <span className="font-medium text-sm text-white">{project.name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onEditProject(project); }}
                className="text-slate-400 hover:text-blue-400 p-1 rounded transition-colors"
                title="Modifica progetto"
              >
                ✏️
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description}</p>
            {project.parent_project_id && (() => {
              const parent = projects.find(candidate => candidate.id === project.parent_project_id);
              return parent ? <p className="mt-1 text-[10px] font-semibold text-blue-300">↳ {parent.emoji} {parent.name}</p> : null;
            })()}
          </div>
        ))}
        {dragOver && columnProjects.length === 0 && (
          <div className="border-2 border-dashed border-slate-500 rounded-xl p-4 text-center text-slate-500 text-sm">
            Rilascia qui
          </div>
        )}
      </div>
    </div>
  );
}

function AreaColumn({
  area,
  projects,
  tasks,
  onMoveProject,
  onOpenProject,
  onEditProject,
}: {
  area: Project | null;
  projects: Project[];
  tasks: Task[];
  onMoveProject: (projectId: string, areaId: string | null) => void;
  onOpenProject: (projectId: string) => void;
  onEditProject: (project: Project) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const children = projects.filter(project => !project.is_area && project.parent_project_id === (area?.id ?? null));
  const childIds = new Set(children.map(project => project.id));
  const relevantTasks = tasks.filter(task => task.project_id && (childIds.has(task.project_id) || task.project_id === area?.id));
  const openTasks = relevantTasks.filter(task => !task.completed);
  const today = dateKey();
  const overdue = openTasks.filter(task => task.due_date && task.due_date < today).length;

  return (
    <section
      className={`min-h-[260px] rounded-2xl border-2 p-4 transition ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-800/55'}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/project-id')) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const projectId = event.dataTransfer.getData('application/project-id');
        if (projectId) onMoveProject(projectId, area?.id ?? null);
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{area?.emoji ?? '🧺'}</span>
            <h3 className="font-bold text-white">{area?.name ?? 'Senza area'}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">{children.length} progetti · {openTasks.length} task aperti</p>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && <span className="rounded-full bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-300">{overdue} scaduti</span>}
          {area && <button onClick={() => onEditProject(area)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Modifica area">✏️</button>}
        </div>
      </div>

      <div className="space-y-2">
        {children.map(project => {
          const projectTasks = tasks.filter(task => task.project_id === project.id && !task.completed);
          const projectOverdue = projectTasks.filter(task => task.due_date && task.due_date < today).length;
          return (
            <div
              key={project.id}
              draggable
              role="button"
              tabIndex={0}
              onClick={() => onOpenProject(project.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenProject(project.id);
                }
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/project-id', project.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900/65 p-3 transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 active:cursor-grabbing"
              style={{ borderLeft: `4px solid ${project.color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-left text-sm font-semibold leading-snug text-white">{project.emoji} {project.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{projectTasks.length} aperti{projectOverdue > 0 ? ` · ${projectOverdue} scaduti` : ''}</p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditProject(project);
                  }}
                  className="shrink-0 rounded p-1 text-xs text-slate-500 hover:text-blue-300"
                  title="Modifica progetto"
                >
                  ✏️
                </button>
              </div>
            </div>
          );
        })}
        {children.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-600 p-5 text-center text-sm text-slate-500">
            Trascina qui un progetto
          </div>
        )}
      </div>
    </section>
  );
}

function AreaBoard({
  projects,
  tasks,
  onMoveProject,
  onOpenProject,
  onEditProject,
}: {
  projects: Project[];
  tasks: Task[];
  onMoveProject: (projectId: string, areaId: string | null) => void;
  onOpenProject: (projectId: string) => void;
  onEditProject: (project: Project) => void;
}) {
  const areas = projects.filter(project => project.is_area);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-white">Territori di lavoro</h2>
        <p className="mt-1 text-sm text-slate-400">Trascina ogni progetto nella sua area. La colonna “Senza area” raccoglie ciò che deve ancora essere classificato.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map(area => (
          <AreaColumn key={area.id} area={area} projects={projects} tasks={tasks} onMoveProject={onMoveProject} onOpenProject={onOpenProject} onEditProject={onEditProject} />
        ))}
        <AreaColumn area={null} projects={projects} tasks={tasks} onMoveProject={onMoveProject} onOpenProject={onOpenProject} onEditProject={onEditProject} />
      </div>
    </div>
  );
}

function EditTaskModal({ 
  isOpen, 
  onClose, 
  task,
  onSave,
  projects 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  task: Task | null;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  projects: Project[];
}) {
  const initialTask = task ?? {
    id: '',
    text: '',
    notes: '',
    priority: 'medium' as const,
    category: 'work' as const,
    project_id: null,
    due_date: '',
    completed: false,
    remind_at: null,
    reminder_channel: 'telegram' as const,
    reminder_status: 'pending' as const,
    reminded_at: null,
    created_at: '',
  };

  const [text, setText] = useState(initialTask.text);
  const [notes, setNotes] = useState(initialTask.notes || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(initialTask.priority);
  const [category, setCategory] = useState<'work' | 'admin' | 'personal' | 'travel'>(initialTask.category);
  const [projectId, setProjectId] = useState<string | null>(initialTask.project_id);
  const [dueDate, setDueDate] = useState(initialTask.due_date || '');
  const [remindAt, setRemindAt] = useState(initialTask.remind_at ? initialTask.remind_at.slice(0, 16) : '');
  const [reminderChannel, setReminderChannel] = useState<'telegram' | 'email'>(initialTask.reminder_channel ?? 'telegram');
  const [reminderStatus, setReminderStatus] = useState<'pending' | 'sent' | 'skipped'>(initialTask.reminder_status ?? 'pending');

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSave(task.id, {
        text: text.trim(),
        notes: notes.trim(),
        priority,
        category,
        project_id: projectId,
        due_date: dueDate || null,
        remind_at: remindAt ? new Date(remindAt).toISOString() : null,
        reminder_channel: reminderChannel,
        reminder_status: remindAt ? reminderStatus : 'pending',
        reminded_at: reminderStatus === 'sent' && remindAt ? task.reminded_at ?? new Date().toISOString() : null,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 border-slate-600 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-white">✏️ Modifica Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Task</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">📝 Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Priorità</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="high">🔴 Alta</option>
                <option value="medium">🟡 Media</option>
                <option value="low">⚪ Bassa</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="work">💼 Lavoro</option>
                <option value="admin">📋 Admin</option>
                <option value="personal">👤 Personale</option>
                <option value="travel">✈️ Viaggio</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Progetto</label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="">Nessun progetto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Scadenza</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Reminder</label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Quando vuoi ricevere il promemoria vero.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Canale</label>
              <select
                value={reminderChannel}
                onChange={(e) => setReminderChannel(e.target.value as 'telegram' | 'email')}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Stato reminder</label>
              <select
                value={reminderStatus}
                onChange={(e) => setReminderStatus(e.target.value as 'pending' | 'sent' | 'skipped')}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
                disabled={!remindAt}
              >
                <option value="pending">Programmato</option>
                <option value="sent">Inviato</option>
                <option value="skipped">Saltato</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              💾 Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddTaskModal({ 
  isOpen, 
  onClose,
  onAdd,
  projects,
  defaultProjectId = null,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (task: Omit<Task, 'id' | 'created_at'>) => void;
  projects: Project[];
  defaultProjectId?: string | null;
}) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState<'work' | 'admin' | 'personal' | 'travel'>('work');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [dueDate, setDueDate] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [reminderChannel, setReminderChannel] = useState<'telegram' | 'email'>('telegram');

  useEffect(() => {
    if (isOpen) setProjectId(defaultProjectId);
  }, [isOpen, defaultProjectId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd({
        text: text.trim(),
        notes: notes.trim(),
        priority,
        category,
        project_id: projectId,
        due_date: dueDate || null,
        completed: false,
        remind_at: remindAt ? new Date(remindAt).toISOString() : null,
        reminder_channel: reminderChannel,
        reminder_status: 'pending',
        reminded_at: null,
      });
      setText('');
      setNotes('');
      setPriority('medium');
      setCategory('work');
      setProjectId(null);
      setDueDate('');
      setRemindAt('');
      setReminderChannel('telegram');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 border-slate-600 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-white">➕ Nuovo Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Task</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cosa devi fare?"
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">📝 Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dettagli opzionali..."
              rows={2}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Priorità</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="high">🔴 Alta</option>
                <option value="medium">🟡 Media</option>
                <option value="low">⚪ Bassa</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-slate-300 mb-1 font-medium">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="work">💼 Lavoro</option>
                <option value="admin">📋 Admin</option>
                <option value="personal">👤 Personale</option>
                <option value="travel">✈️ Viaggio</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Progetto</label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="">Nessun progetto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Scadenza</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Reminder</label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Se lo imposti, il task e` pronto per i promemoria automatici.</p>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Canale reminder</label>
            <select
              value={reminderChannel}
              onChange={(e) => setReminderChannel(e.target.value as 'telegram' | 'email')}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="telegram">Telegram</option>
              <option value="email">Email</option>
            </select>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              ➕ Aggiungi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getProjectDescendantIds(projectId: string, projects: Project[]) {
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const candidate of projects) {
      if (candidate.parent_project_id === projectId || (candidate.parent_project_id && descendants.has(candidate.parent_project_id))) {
        if (!descendants.has(candidate.id)) {
          descendants.add(candidate.id);
          changed = true;
        }
      }
    }
  }

  return descendants;
}

function EditProjectModal({
  isOpen,
  onClose,
  project,
  projects,
  onSave,
  onDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  projects: Project[];
  onSave: (projectId: string, updates: Partial<Project>) => void;
  onDelete: (projectId: string) => void;
}) {
  const initial = project ?? { id: '', name: '', description: '', emoji: '📁', color: '#3b82f6', status: 'backlog' as const, parent_project_id: null, is_area: false };
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const [status, setStatus] = useState(initial.status);
  const [parentProjectId, setParentProjectId] = useState<string | null>(initial.parent_project_id);
  const [isArea, setIsArea] = useState(initial.is_area);

  if (!isOpen || !project) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(project.id, { name: name.trim(), description: description.trim(), emoji, color, status, parent_project_id: isArea ? null : parentProjectId, is_area: isArea });
      onClose();
    }
  };

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const emojis = ['📁', '🚀', '💡', '🎯', '📊', '🔧', '🌱', '⭐', '🔬', '📱', '🇪🇺', '🌍', '🍎', '🏡', '⚠️', '🎓', '🍺', '🫒', '🍕'];
  const invalidParentIds = getProjectDescendantIds(project.id, projects);
  invalidParentIds.add(project.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 border-slate-600 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 text-white">✏️ Modifica Progetto</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Descrizione</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Stato</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none">
              <option value="backlog">📥 Backlog</option>
              <option value="active">🔄 In Corso</option>
              <option value="done">✅ Completato</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-600 bg-slate-700/50 p-3">
            <input type="checkbox" checked={isArea} onChange={(e) => setIsArea(e.target.checked)} className="h-5 w-5 accent-blue-500" />
            <span>
              <span className="block text-sm font-semibold text-white">Questa è un’area</span>
              <span className="block text-xs text-slate-400">Può contenere e organizzare altri progetti.</span>
            </span>
          </label>
          {!isArea && <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Area / progetto padre</label>
            <select
              value={parentProjectId ?? ''}
              onChange={(e) => setParentProjectId(e.target.value || null)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="">Nessuna — progetto principale</option>
              {projects
                .filter(candidate => candidate.is_area && !invalidParentIds.has(candidate.id))
                .map(candidate => (
                  <option key={candidate.id} value={candidate.id}>{candidate.emoji} {candidate.name}</option>
                ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Esempio: assegna un sottoprogetto all’area POSTI.</p>
          </div>}
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)} className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${emoji === e ? 'bg-slate-600 ring-2 ring-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">Colore</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold">Annulla</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">💾 Salva</button>
          </div>
          <button
            type="button"
            onClick={() => { if (confirm(`Eliminare il progetto "${project.name}"? I task associati non verranno eliminati.`)) { onDelete(project.id); onClose(); } }}
            className="w-full mt-3 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm font-medium border border-red-500/30"
          >
            🗑️ Elimina progetto
          </button>
        </form>
      </div>
    </div>
  );
}

function AddProjectModal({ 
  isOpen, 
  onClose, 
  onAdd,
  projects,
  defaultIsArea = false,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (project: Omit<Project, 'id'>) => void;
  projects: Project[];
  defaultIsArea?: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState('#3b82f6');
  const [parentProjectId, setParentProjectId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd({
        name: name.trim(),
        description: description.trim(),
        emoji,
        color,
        status: defaultIsArea ? 'active' : 'backlog',
        parent_project_id: defaultIsArea ? null : parentProjectId,
        is_area: defaultIsArea,
      });
      setName('');
      setDescription('');
      setEmoji('📁');
      setColor('#3b82f6');
      setParentProjectId(null);
      onClose();
    }
  };

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const emojis = ['📁', '🚀', '💡', '🎯', '📊', '🔧', '🌱', '⭐', '🔬', '📱'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border-2 border-slate-600 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-white">{defaultIsArea ? '🗂️ Nuova Area' : '📁 Nuovo Progetto'}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome del progetto"
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Descrizione</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione"
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
          </div>

          {!defaultIsArea && <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Area / progetto padre</label>
            <select
              value={parentProjectId ?? ''}
              onChange={(e) => setParentProjectId(e.target.value || null)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="">Nessuna — progetto principale</option>
              {projects.filter(candidate => candidate.is_area).map(candidate => (
                <option key={candidate.id} value={candidate.id}>{candidate.emoji} {candidate.name}</option>
              ))}
            </select>
          </div>}
          
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                    emoji === e ? 'bg-slate-600 ring-2 ring-white' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-2 font-medium">Colore</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
            >
              ➕ Crea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type TimeFilter = 'all' | 'overdue' | 'today' | 'week' | 'unscheduled';

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysKey(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function OverviewDashboard({
  tasks,
  projects,
  onToggleTask,
  onEditTask,
  onOpenTasks,
  onOpenProjects,
}: {
  tasks: Task[];
  projects: Project[];
  onToggleTask: (taskId: string) => void | Promise<void>;
  onEditTask: (task: Task) => void;
  onOpenTasks: (timeFilter: TimeFilter, projectId?: string | null) => void;
  onOpenProjects: () => void;
}) {
  const today = dateKey();
  const weekEnd = addDaysKey(7);
  const openTasks = tasks.filter(task => !task.completed);
  const overdueTasks = openTasks.filter(task => task.due_date && task.due_date < today);
  const todayTasks = openTasks.filter(task => task.due_date === today);
  const weekTasks = openTasks.filter(task => task.due_date && task.due_date > today && task.due_date <= weekEnd);
  const unscheduledTasks = openTasks.filter(task => !task.due_date);
  const unassignedTasks = openTasks.filter(task => !task.project_id);

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const focusTasks = [...openTasks]
    .sort((a, b) => {
      const aUrgency = a.due_date && a.due_date < today ? 0 : a.due_date === today ? 1 : a.due_date ? 2 : 3;
      const bUrgency = b.due_date && b.due_date < today ? 0 : b.due_date === today ? 1 : b.due_date ? 2 : 3;
      if (aUrgency !== bUrgency) return aUrgency - bUrgency;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31');
    })
    .slice(0, 5);

  const posterProjects: Array<Project & { synthetic?: boolean }> = [
    ...projects,
    {
      id: '__none__',
      name: 'Area generale',
      status: 'active',
      color: '#94a3b8',
      emoji: '🧭',
      description: 'Attività non ancora assegnate a un progetto',
      parent_project_id: null,
      is_area: true,
      synthetic: true,
    },
  ];

  const projectOverview = posterProjects
    .map(project => {
      const parent = project.parent_project_id ? projects.find(candidate => candidate.id === project.parent_project_id) : undefined;
      const projectTasks = tasks.filter(task => project.synthetic ? !task.project_id : task.project_id === project.id);
      const open = projectTasks.filter(task => !task.completed);
      const overdue = open.filter(task => task.due_date && task.due_date < today).length;
      const high = open.filter(task => task.priority === 'high').length;
      const completed = projectTasks.filter(task => task.completed).length;
      const progress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : 0;
      const nextAction = [...open].sort((a, b) => {
        const aUrgency = a.due_date && a.due_date < today ? 0 : a.due_date === today ? 1 : a.due_date ? 2 : 3;
        const bUrgency = b.due_date && b.due_date < today ? 0 : b.due_date === today ? 1 : b.due_date ? 2 : 3;
        if (aUrgency !== bUrgency) return aUrgency - bUrgency;
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
        return (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31');
      })[0];
      const reminder = [...open]
        .filter(task => task.remind_at && task.reminder_status === 'pending')
        .sort((a, b) => (a.remind_at ?? '').localeCompare(b.remind_at ?? ''))[0];
      const health = project.status === 'done'
        ? { label: 'Chiuso', dot: 'bg-emerald-400', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' }
        : overdue > 0 || high >= 3
          ? { label: 'Critico', dot: 'bg-rose-400', tone: 'border-rose-500/40 bg-rose-500/10 text-rose-200' }
          : high > 0 || (reminder?.remind_at && new Date(reminder.remind_at) < new Date())
            ? { label: 'Attenzione', dot: 'bg-amber-400', tone: 'border-amber-500/35 bg-amber-500/10 text-amber-200' }
            : open.length === 0
              ? { label: 'In attesa', dot: 'bg-slate-400', tone: 'border-slate-600 bg-slate-700/30 text-slate-300' }
              : { label: 'In ordine', dot: 'bg-sky-400', tone: 'border-sky-500/30 bg-sky-500/10 text-sky-200' };
      return { project, parent, open: open.length, overdue, high, progress, nextAction, reminder, health };
    })
    .sort((a, b) => {
      const statusOrder = { active: 0, backlog: 1, done: 2 };
      const statusDifference = statusOrder[a.project.status] - statusOrder[b.project.status];
      if (statusDifference !== 0) return statusDifference;
      return (b.overdue * 4 + b.high * 2 + b.open) - (a.overdue * 4 + a.high * 2 + a.open);
    });

  const importantReminders = [...openTasks]
    .filter(task => task.remind_at && task.reminder_status === 'pending')
    .sort((a, b) => (a.remind_at ?? '').localeCompare(b.remind_at ?? ''))
    .slice(0, 5);

  const dateLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const firstNameGreeting = new Date().getHours() < 13 ? 'Buongiorno' : new Date().getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';

  const metricCards: { label: string; value: number; helper: string; filter: TimeFilter; tone: string }[] = [
    { label: 'Scaduti', value: overdueTasks.length, helper: 'richiedono una decisione', filter: 'overdue', tone: 'border-rose-500/30 bg-rose-500/10 text-rose-200' },
    { label: 'Oggi', value: todayTasks.length, helper: 'con scadenza oggi', filter: 'today', tone: 'border-sky-500/30 bg-sky-500/10 text-sky-100' },
    { label: 'Prossimi 7 giorni', value: weekTasks.length, helper: 'in arrivo', filter: 'week', tone: 'border-violet-500/30 bg-violet-500/10 text-violet-100' },
    { label: 'Senza data', value: unscheduledTasks.length, helper: 'da pianificare', filter: 'unscheduled', tone: 'border-slate-600 bg-slate-800/80 text-slate-100' },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="project-map" className="overflow-hidden rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950/60 p-4 shadow-2xl shadow-slate-950/30 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold capitalize text-blue-300">{dateLabel}</p>
            <h2 id="project-map" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">La tua mappa dei progetti</h2>
            <p className="mt-2 max-w-3xl text-slate-300">{firstNameGreeting}. Ogni riquadro mostra cosa richiede attenzione e la prossima azione concreta.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-200">● {projectOverview.filter(item => item.health.label === 'Critico').length} critici</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-200">● {projectOverview.filter(item => item.health.label === 'Attenzione').length} da seguire</span>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-blue-200">{projects.filter(project => project.is_area).length} aree · {projects.filter(project => !project.is_area).length} progetti</span>
            <button onClick={onOpenProjects} className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-slate-200 hover:border-slate-400">Gestisci aree →</button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {projectOverview.map(({ project, parent, open, overdue, high, progress, nextAction, reminder, health }) => (
            <article
              key={project.id}
              className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/55 p-4 transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900/80"
              style={{ borderTopColor: project.color, borderTopWidth: '3px' }}
            >
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onOpenTasks('all', project.synthetic ? null : project.id)} className="min-w-0 text-left">
                  <span className="block truncate text-lg font-bold text-white">{project.emoji} {project.name}</span>
                  {parent && <span className="mt-1 inline-flex rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-200">↳ dentro {parent.emoji} {parent.name}</span>}
                  <span className="mt-1 block truncate text-xs text-slate-400">{project.description || 'Nessuna descrizione'}</span>
                </button>
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${health.tone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />{health.label}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <span>{open} aperti</span>
                {overdue > 0 && <span className="font-semibold text-rose-300">· {overdue} scaduti</span>}
                {high > 0 && <span className="text-amber-300">· {high} alta priorità</span>}
                <span className="ml-auto">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: project.color }} />
              </div>

              <div className="mt-4 flex-1 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">In corso · prossima azione</p>
                {nextAction ? (
                  <button onClick={() => onEditTask(nextAction)} className="mt-1.5 w-full text-left">
                    <span className="line-clamp-2 block text-sm font-semibold leading-snug text-slate-100 hover:text-white">{nextAction.text}</span>
                    {nextAction.notes && <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-400">📝 {nextAction.notes}</span>}
                  </button>
                ) : (
                  <p className="mt-1.5 text-sm text-slate-500">Nessuna attività aperta</p>
                )}
              </div>

              <div className="mt-3 min-h-5 text-xs">
                {reminder?.remind_at ? (
                  <button onClick={() => onEditTask(reminder)} className="flex w-full items-center gap-2 text-left text-cyan-200 hover:text-cyan-100">
                    <span>⏰</span>
                    <span className="truncate">{formatReminderDate(reminder.remind_at)} · {reminder.text}</span>
                  </button>
                ) : (
                  <span className="text-slate-600">Nessun reminder importante</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="overview-metrics">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="overview-metrics" className="text-lg font-bold text-white">Situazione generale</h2>
          <span className="text-sm text-slate-400">{openTasks.length} attività aperte</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricCards.map(metric => (
            <button
              key={metric.label}
              onClick={() => onOpenTasks(metric.filter)}
              className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-400 ${metric.tone}`}
            >
              <span className="block text-3xl font-bold">{metric.value}</span>
              <span className="mt-1 block font-semibold">{metric.label}</span>
              <span className="mt-1 block text-xs opacity-70">{metric.helper}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <section aria-labelledby="daily-focus" className="rounded-2xl border border-slate-700 bg-slate-800/55 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="daily-focus" className="text-lg font-bold text-white">Focus operativo</h2>
              <p className="text-sm text-slate-400">Le prime cose da affrontare, ordinate per urgenza.</p>
            </div>
            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">Top {focusTasks.length}</span>
          </div>
          {focusTasks.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-100">
              Tutto libero: non ci sono attività aperte.
            </div>
          ) : (
            <div className="space-y-2">
              {focusTasks.map(task => {
                const project = projects.find(item => item.id === task.project_id);
                const isOverdue = task.due_date && task.due_date < today;
                return (
                  <div key={task.id} className="group flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/55 p-3 transition hover:border-slate-500">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-slate-500 text-transparent transition hover:border-emerald-400 hover:bg-emerald-500/10"
                      aria-label={`Completa ${task.text}`}
                    >
                      ✓
                    </button>
                    <button onClick={() => onEditTask(task)} className="min-w-0 flex-1 text-left">
                      <span className="block font-medium text-slate-100 group-hover:text-white">{task.text}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {project && <span style={{ color: project.color }}>{project.emoji} {project.name}</span>}
                        {task.due_date && (
                          <span className={isOverdue ? 'font-semibold text-rose-300' : task.due_date === today ? 'font-semibold text-sky-300' : ''}>
                            {isOverdue ? 'Scaduto · ' : task.due_date === today ? 'Oggi · ' : ''}
                            {new Date(`${task.due_date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        <span>{task.priority === 'high' ? 'Priorità alta' : task.priority === 'medium' ? 'Priorità media' : 'Priorità bassa'}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-700 bg-slate-800/55 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Reminder importanti</h2>
                <p className="text-sm text-slate-400">I prossimi avvisi ancora da gestire.</p>
              </div>
            </div>
            <div className="space-y-3">
              {importantReminders.map(task => {
                const project = projects.find(item => item.id === task.project_id);
                const isLate = task.remind_at ? new Date(task.remind_at) < new Date() : false;
                return (
                <button
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/45 p-3 text-left transition hover:border-slate-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 min-w-0 text-sm font-semibold text-white">{task.text}</span>
                    <span className={`shrink-0 text-xs font-semibold ${isLate ? 'text-rose-300' : 'text-cyan-200'}`}>
                      {isLate ? 'Scaduto' : 'Programmato'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>⏰ {task.remind_at && formatReminderDate(task.remind_at)}</span>
                    {project && <span style={{ color: project.color }}>{project.emoji} {project.name}</span>}
                  </div>
                </button>
              )})}
              {importantReminders.length === 0 && <p className="rounded-xl bg-slate-900/40 p-4 text-sm text-slate-400">Nessun reminder programmato.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-800/55 p-5">
            <h2 className="font-bold text-white">Da mettere in ordine</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => onOpenTasks('unscheduled')} className="rounded-xl bg-slate-900/50 p-3 text-left hover:bg-slate-900">
                <span className="block text-xl font-bold text-white">{unscheduledTasks.length}</span>
                <span className="text-xs text-slate-400">senza scadenza</span>
              </button>
              <button onClick={() => onOpenTasks('all', null)} className="rounded-xl bg-slate-900/50 p-3 text-left hover:bg-slate-900">
                <span className="block text-xl font-bold text-white">{unassignedTasks.length}</span>
                <span className="text-xs text-slate-400">senza progetto</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function Home() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'areas' | 'projects'>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [taskReturnTab, setTaskReturnTab] = useState<'overview' | 'areas' | 'projects'>('areas');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped' | 'canvas'>('list');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [backendMode, setBackendMode] = useState<'remote' | 'local'>('remote');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  async function refreshData(showLoader = false) {
    if (showLoader) setLoading(true);
    const mode = await getBackendMode();
    const [tasksData, projectsData] = await Promise.all([getTasks(), getProjects()]);
    const syncStatus = getSyncStatus();
    setBackendMode(mode);
    setTasks(tasksData);
    setProjects(projectsData);
    setPendingSyncCount(syncStatus.pendingCount);
    setSyncing(syncStatus.syncing);
    setLastSyncError(syncStatus.lastSyncError);
    if (showLoader) setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshData(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const mode = await getBackendMode();
      setBackendMode(mode);

      if (mode === 'remote') {
        setSyncing(true);
        const synced = await syncPendingChanges();
        const syncStatus = getSyncStatus();
        setPendingSyncCount(syncStatus.pendingCount);
        setLastSyncError(syncStatus.lastSyncError);
        setSyncing(syncStatus.syncing);

        if (synced) {
          await refreshData(false);
        }
      } else {
        const syncStatus = getSyncStatus();
        setPendingSyncCount(syncStatus.pendingCount);
        setLastSyncError(syncStatus.lastSyncError);
        setSyncing(syncStatus.syncing);
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  const refreshSyncStatus = () => {
    const syncStatus = getSyncStatus();
    setPendingSyncCount(syncStatus.pendingCount);
    setSyncing(syncStatus.syncing);
    setLastSyncError(syncStatus.lastSyncError);
  };

  // Quick add task
  const handleQuickAdd = async (text: string) => {
    const newTask = await addTask({
      text,
      notes: '',
      project_id: selectedProjectId,
      priority: 'medium',
      due_date: null,
      category: 'work',
      completed: false,
      remind_at: null,
      reminder_channel: 'telegram',
      reminder_status: 'pending',
      reminded_at: null,
    });
    if (newTask) {
      setTasks(prev => [newTask, ...prev]);
      refreshSyncStatus();
    }
  };

  // Add task with details
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'created_at'>) => {
    const newTask = await addTask(taskData);
    if (newTask) {
      setTasks(prev => [newTask, ...prev]);
      refreshSyncStatus();
    }
  };

  // Toggle task completion
  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updated = await updateTask(taskId, { completed: !task.completed });
      if (updated) {
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        refreshSyncStatus();
      }
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    const success = await deleteTask(taskId);
    if (success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      refreshSyncStatus();
    }
  };

  // Update task
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    const updated = await updateTask(taskId, updates);
    if (updated) {
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      refreshSyncStatus();
    }
  };

  // Add project
  const handleAddProject = async (projectData: Omit<Project, 'id'>) => {
    const newProject = await addProject(projectData);
    if (newProject) {
      setProjects(prev => [...prev, newProject]);
      refreshSyncStatus();
    }
  };

  // Update project
  const handleUpdateProject = async (projectId: string, updates: Partial<Project>) => {
    const updated = await updateProject(projectId, updates);
    if (updated) {
      setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      refreshSyncStatus();
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    const success = await deleteProject(projectId);
    if (success) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProjectId === projectId) setSelectedProjectId(null);
      refreshSyncStatus();
    }
  };

  // Move project to different status
  const handleMoveProject = async (projectId: string, newStatus: 'backlog' | 'active' | 'done') => {
    const updated = await updateProject(projectId, { status: newStatus });
    if (updated) {
      setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      refreshSyncStatus();
    }
  };

  const handleMoveProjectToArea = async (projectId: string, areaId: string | null) => {
    const updated = await updateProject(projectId, { parent_project_id: areaId });
    if (updated) {
      setProjects(prev => prev.map(project => project.id === projectId ? updated : project));
      refreshSyncStatus();
    }
  };

  const handleOpenProject = (projectId: string, returnTab: 'overview' | 'areas' | 'projects' = 'areas') => {
    setSelectedProjectId(projectId);
    setTaskReturnTab(returnTab);
    setUnassignedOnly(false);
    setFilter('all');
    setCategoryFilter('all');
    setTimeFilter('all');
    setViewMode('list');
    setActiveTab('tasks');
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active' && task.completed) return false;
    if (filter === 'completed' && !task.completed) return false;
    if (selectedProjectId && task.project_id !== selectedProjectId) return false;
    if (unassignedOnly && task.project_id) return false;
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    const today = dateKey();
    const weekEnd = addDaysKey(7);
    if (timeFilter === 'overdue' && (!task.due_date || task.due_date >= today)) return false;
    if (timeFilter === 'today' && task.due_date !== today) return false;
    if (timeFilter === 'week' && (!task.due_date || task.due_date <= today || task.due_date > weekEnd)) return false;
    if (timeFilter === 'unscheduled' && task.due_date) return false;
    return true;
  });

  // Sort tasks: overdue and upcoming dates first, then priority.
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === 'high').length;
  const selectedProject = selectedProjectId ? projects.find(project => project.id === selectedProjectId) : undefined;
  const selectedProjectTasks = selectedProjectId ? tasks.filter(task => task.project_id === selectedProjectId) : [];
  const selectedProjectOpenTasks = selectedProjectTasks.filter(task => !task.completed).length;
  const selectedProjectCompletedTasks = selectedProjectTasks.length - selectedProjectOpenTasks;

  if (loading) {
    return (
      <main className="min-h-screen text-white bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-slate-400">Caricamento...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800 shadow-lg">
        <div className="mx-auto max-w-[1500px] px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">⚡ SwitchBoard</h1>
              <p className="text-sm text-slate-400">
                Task & Projects • {backendMode === 'remote' ? 'Supabase' : 'Modalita locale'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddTask(true)}
                className="bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 px-4 py-2 rounded-xl text-sm font-semibold"
              >
                + Task
              </button>
              <button
                onClick={() => setShowAddProject(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                + Progetto
              </button>
              <button
                onClick={() => setShowAddArea(true)}
                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
              >
                + Area
              </button>
            </div>
          </div>

          {backendMode === 'local' && (
            <div className="mt-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <div className="font-semibold">Stai lavorando in locale.</div>
              <div>
                Supabase non risponde. Le modifiche restano in coda su questo dispositivo e verranno sincronizzate appena torna disponibile.
              </div>
              {pendingSyncCount > 0 && (
                <div className="mt-1">
                  Modifiche in attesa di sync: {pendingSyncCount}
                </div>
              )}
              {lastSyncError && (
                <div className="mt-1 text-amber-300/90">
                  Ultimo errore sync: {lastSyncError}
                </div>
              )}
            </div>
          )}

          {backendMode === 'remote' && pendingSyncCount > 0 && (
            <div className="mt-4 rounded-xl border-2 border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
              {syncing ? 'Sincronizzazione con Supabase in corso...' : `Supabase di nuovo online. ${pendingSyncCount} modifiche in attesa di sincronizzazione.`}
            </div>
          )}
          
          {/* Compact counters remain useful in the operational views. */}
          {activeTab !== 'overview' && <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-slate-700 rounded-xl p-3 text-center border-2 border-slate-600">
              <div className="text-2xl font-bold text-white">{totalTasks - completedTasks}</div>
              <div className="text-xs text-slate-400 font-medium">Da fare</div>
            </div>
            <div className="bg-red-500/20 rounded-xl p-3 text-center border-2 border-red-500/40">
              <div className="text-2xl font-bold text-red-400">{highPriorityTasks}</div>
              <div className="text-xs text-red-400 font-medium">Priorità alta</div>
            </div>
            <div className="bg-green-500/20 rounded-xl p-3 text-center border-2 border-green-500/40">
              <div className="text-2xl font-bold text-green-400">{completedTasks}</div>
              <div className="text-xs text-green-400 font-medium">Completati</div>
            </div>
          </div>}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/80 sticky top-0 z-20 backdrop-blur-xl">
        <div className="mx-auto max-w-[1500px] px-4">
          <div className="flex gap-2 overflow-x-auto py-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ☀️ Oggi
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              ✅ Task
            </button>
            <button
              onClick={() => setActiveTab('areas')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'areas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              🗂️ Aree
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'projects' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              📊 Progetti
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="mx-auto max-w-[1500px] px-4 py-6">
        {activeTab === 'overview' && (
          <OverviewDashboard
            tasks={tasks}
            projects={projects}
            onToggleTask={handleToggleTask}
            onEditTask={setEditingTask}
            onOpenTasks={(nextTimeFilter, projectId) => {
              setTaskReturnTab('overview');
              setFilter('active');
              setTimeFilter(nextTimeFilter);
              setUnassignedOnly(projectId === null);
              setSelectedProjectId(projectId && projectId.length > 0 ? projectId : null);
              setViewMode('list');
              setActiveTab('tasks');
            }}
            onOpenProjects={() => setActiveTab('areas')}
          />
        )}
        
        {activeTab === 'tasks' && (
          <div>
            {selectedProject && (
              <section
                className="mb-5 rounded-2xl border border-slate-700 bg-slate-800/70 p-4 shadow-lg"
                style={{ borderLeft: `6px solid ${selectedProject.color}` }}
                aria-label={`Progetto ${selectedProject.name}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <button
                      onClick={() => {
                        setSelectedProjectId(null);
                        setActiveTab(taskReturnTab);
                      }}
                      className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-blue-400 hover:text-white"
                    >
                      ← Torna indietro
                    </button>
                    <div className="flex items-start gap-3">
                      <span className="text-3xl" aria-hidden="true">{selectedProject.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Progetto aperto</p>
                        <h2 className="break-words text-2xl font-bold leading-tight text-white">{selectedProject.name}</h2>
                        {selectedProject.description && (
                          <p className="mt-2 max-w-4xl break-words text-justify text-sm leading-relaxed text-slate-300">
                            {selectedProject.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 text-sm">
                    <span className="rounded-full bg-blue-500/15 px-3 py-1.5 font-semibold text-blue-200">{selectedProjectOpenTasks} aperti</span>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-200">{selectedProjectCompletedTasks} completati</span>
                  </div>
                </div>
              </section>
            )}

            <QuickCapture onAdd={handleQuickAdd} />
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex bg-slate-800 rounded-lg p-1 border-2 border-slate-700">
                {(['all', 'active', 'completed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      filter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f === 'all' ? 'Tutti' : f === 'active' ? 'Attivi' : 'Completati'}
                  </button>
                ))}
              </div>

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                aria-label="Filtra per scadenza"
                className="bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none text-white"
              >
                <option value="all">Qualsiasi scadenza</option>
                <option value="overdue">🚨 Scaduti</option>
                <option value="today">☀️ Oggi</option>
                <option value="week">🗓️ Prossimi 7 giorni</option>
                <option value="unscheduled">Senza data</option>
              </select>
              
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none text-white"
              >
                <option value="all">Tutte le categorie</option>
                <option value="work">💼 Lavoro</option>
                <option value="admin">📋 Admin</option>
                <option value="personal">👤 Personale</option>
                <option value="travel">✈️ Viaggio</option>
              </select>

              <select
                value={selectedProjectId || ''}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value || null);
                  setUnassignedOnly(false);
                }}
                className="bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none text-white"
              >
                <option value="">{unassignedOnly ? '📋 Senza progetto' : 'Tutti i progetti'}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>

              <div className="flex bg-slate-800 rounded-lg p-1 border-2 border-slate-700">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Per progetto
                </button>
                <button
                  onClick={() => setViewMode('canvas')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === 'canvas' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Canvas
                </button>
              </div>
            </div>

            {/* Task List */}
            {sortedTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/30 px-5 py-12 text-center text-slate-400">
                <div className="mb-4 text-4xl">{selectedProject ? selectedProject.emoji : '🎉'}</div>
                <h3 className="text-lg font-bold text-white">
                  {selectedProject && selectedProjectTasks.length === 0
                    ? `${selectedProject.name} non ha ancora task`
                    : selectedProject
                      ? `Nessun task di ${selectedProject.name} corrisponde ai filtri`
                      : 'Nessun task da mostrare'}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed">
                  {selectedProject && selectedProjectTasks.length === 0
                    ? 'Il progetto è aperto correttamente: puoi inserire qui la prima attività.'
                    : 'Prova a reimpostare i filtri oppure aggiungi una nuova attività.'}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {selectedProject && (
                    <button onClick={() => setShowAddTask(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                      + Aggiungi task a {selectedProject.name}
                    </button>
                  )}
                  {selectedProjectTasks.length > 0 && (
                    <button
                      onClick={() => {
                        setFilter('all');
                        setCategoryFilter('all');
                        setTimeFilter('all');
                      }}
                      className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
                    >
                      Reimposta filtri
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {sortedTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    projects={projects}
                    onToggle={() => handleToggleTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onEdit={() => setEditingTask(task)}
                  />
                ))}
              </div>
            ) : viewMode === 'grouped' ? (
              <div className="space-y-4">
                {(() => {
                  const groups: { key: string; label: string; emoji: string; color: string; tasks: Task[] }[] = [];
                  const byProject = new Map<string | null, Task[]>();
                  for (const t of sortedTasks) {
                    const arr = byProject.get(t.project_id) ?? [];
                    arr.push(t);
                    byProject.set(t.project_id, arr);
                  }
                  for (const p of projects) {
                    const pts = byProject.get(p.id);
                    groups.push({ key: p.id, label: p.name, emoji: p.emoji, color: p.color, tasks: pts ?? [] });
                  }
                  const noProject = byProject.get(null);
                  groups.push({ key: '__none__', label: 'Senza progetto', emoji: '📋', color: '#64748b', tasks: noProject ?? [] });
                  return groups.map(g => {
                    const isOpen = expandedGroups.has(g.key);
                    const targetProjectId = g.key === '__none__' ? null : g.key;
                    return (
                      <div
                        key={g.key}
                        className="rounded-xl border-2 border-slate-700 overflow-hidden transition-colors"
                        onDragOver={(e) => { if (e.dataTransfer.types.includes('application/task-id')) { e.preventDefault(); e.currentTarget.style.borderColor = g.color; } }}
                        onDragLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = '';
                          const taskId = e.dataTransfer.getData('application/task-id');
                          if (taskId) handleUpdateTask(taskId, { project_id: targetProjectId });
                        }}
                      >
                        <button
                          onClick={() => setExpandedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                            return next;
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
                          style={{ borderLeft: `4px solid ${g.color}` }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
                            <span>{g.emoji}</span>
                            <span className="font-semibold text-white">{g.label}</span>
                          </div>
                          <span className="text-sm text-slate-400 font-medium">{g.tasks.length} task</span>
                        </button>
                        {isOpen && (
                          <div className="space-y-2 p-3 bg-slate-900/50">
                            {g.tasks.map(task => (
                              <TaskItem
                                key={task.id}
                                task={task}
                                projects={projects}
                                onToggle={() => handleToggleTask(task.id)}
                                onDelete={() => handleDeleteTask(task.id)}
                                onEdit={() => setEditingTask(task)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : viewMode === 'canvas' ? (
              <CanvasView
                tasks={sortedTasks}
                projects={projects}
                onMoveTask={(taskId, projectId) => handleUpdateTask(taskId, { project_id: projectId })}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onEditTask={setEditingTask}
              />
            ) : null}
          </div>
        )}

        {activeTab === 'areas' && (
          <AreaBoard
            projects={projects}
            tasks={tasks}
            onMoveProject={handleMoveProjectToArea}
            onOpenProject={(projectId) => handleOpenProject(projectId, 'areas')}
            onEditProject={setEditingProject}
          />
        )}

        {activeTab === 'projects' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KanbanColumn
                title="📥 Backlog"
                status="backlog"
                projects={projects}
                onMoveProject={handleMoveProject}
                onSelectProject={(id) => {
                  if (id) handleOpenProject(id, 'projects');
                }}
                onEditProject={setEditingProject}
                selectedProjectId={selectedProjectId}
              />
              <KanbanColumn
                title="🔄 In Corso"
                status="active"
                projects={projects}
                onMoveProject={handleMoveProject}
                onSelectProject={(id) => {
                  if (id) handleOpenProject(id, 'projects');
                }}
                onEditProject={setEditingProject}
                selectedProjectId={selectedProjectId}
              />
              <KanbanColumn
                title="✅ Completati"
                status="done"
                projects={projects}
                onMoveProject={handleMoveProject}
                onSelectProject={(id) => {
                  if (id) handleOpenProject(id, 'projects');
                }}
                onEditProject={setEditingProject}
                selectedProjectId={selectedProjectId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddTaskModal
        key={selectedProjectId ?? 'add-task'}
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onAdd={handleAddTask}
        projects={projects}
        defaultProjectId={selectedProjectId}
      />
      
      <AddProjectModal
        isOpen={showAddProject}
        onClose={() => setShowAddProject(false)}
        onAdd={handleAddProject}
        projects={projects}
      />

      <AddProjectModal
        key="add-area"
        isOpen={showAddArea}
        onClose={() => setShowAddArea(false)}
        onAdd={handleAddProject}
        projects={projects}
        defaultIsArea
      />
      
      <EditProjectModal
        key={editingProject?.id ?? 'edit-project'}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        projects={projects}
        onSave={handleUpdateProject}
        onDelete={handleDeleteProject}
      />

      <EditTaskModal
        key={editingTask?.id ?? 'edit-task'}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={handleUpdateTask}
        projects={projects}
      />
    </main>
  );
}
