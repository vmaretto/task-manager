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
  projects 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (task: Omit<Task, 'id' | 'created_at'>) => void;
  projects: Project[];
}) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState<'work' | 'admin' | 'personal' | 'travel'>('work');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [reminderChannel, setReminderChannel] = useState<'telegram' | 'email'>('telegram');

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

function EditProjectModal({
  isOpen,
  onClose,
  project,
  onSave,
  onDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSave: (projectId: string, updates: Partial<Project>) => void;
  onDelete: (projectId: string) => void;
}) {
  const initial = project ?? { id: '', name: '', description: '', emoji: '📁', color: '#3b82f6', status: 'backlog' as const };
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [color, setColor] = useState(initial.color);
  const [status, setStatus] = useState(initial.status);

  if (!isOpen || !project) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(project.id, { name: name.trim(), description: description.trim(), emoji, color, status });
      onClose();
    }
  };

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const emojis = ['📁', '🚀', '💡', '🎯', '📊', '🔧', '🌱', '⭐', '🔬', '📱', '🇪🇺', '🌍', '🍎', '🏡', '⚠️', '🎓', '🍺', '🫒', '🍕'];

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
  onAdd 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAdd: (project: Omit<Project, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState('#3b82f6');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd({
        name: name.trim(),
        description: description.trim(),
        emoji,
        color,
        status: 'backlog',
      });
      setName('');
      setDescription('');
      setEmoji('📁');
      setColor('#3b82f6');
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
        <h3 className="text-xl font-bold mb-4 text-white">📁 Nuovo Progetto</h3>
        
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

// ============================================
// MAIN APP
// ============================================
export default function Home() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active' && task.completed) return false;
    if (filter === 'completed' && !task.completed) return false;
    if (selectedProjectId && task.project_id !== selectedProjectId) return false;
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    return true;
  });

  // Sort tasks: high priority first
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === 'high').length;

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
      <header className="border-b-2 border-slate-700 bg-slate-800 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
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
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b-2 border-slate-700 bg-slate-800/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-4 py-3">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              ✅ Task
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                activeTab === 'projects' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              📊 Progetti
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {activeTab === 'tasks' && (
          <div>
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
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none text-white"
              >
                <option value="">Tutti i progetti</option>
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
              <div className="text-center py-12 text-slate-500">
                <div className="text-4xl mb-4">🎉</div>
                <p>Nessun task da mostrare!</p>
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

        {activeTab === 'projects' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KanbanColumn
                title="📥 Backlog"
                status="backlog"
                projects={projects}
                onMoveProject={handleMoveProject}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  if (id) setActiveTab('tasks');
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
                  setSelectedProjectId(id);
                  if (id) setActiveTab('tasks');
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
                  setSelectedProjectId(id);
                  if (id) setActiveTab('tasks');
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
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onAdd={handleAddTask}
        projects={projects}
      />
      
      <AddProjectModal
        isOpen={showAddProject}
        onClose={() => setShowAddProject(false)}
        onAdd={handleAddProject}
      />
      
      <EditProjectModal
        key={editingProject?.id ?? 'edit-project'}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
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
