'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================
// TYPES
// ============================================
interface Task {
  id: string;
  text: string;
  projectId: string | null;
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  category: 'work' | 'admin' | 'personal' | 'travel';
  completed: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  status: 'backlog' | 'active' | 'done';
  color: string;
  emoji: string;
  description: string;
}

// ============================================
// INITIAL DATA
// ============================================
const initialProjects: Project[] = [
  { id: 'master-cf', name: 'Master Carbon Farming', status: 'active', color: '#10b981', emoji: '🌱', description: 'Direttore Operativo - Università della Tuscia' },
  { id: 'switch', name: 'SWITCH', status: 'active', color: '#3b82f6', emoji: '🇪🇺', description: 'Horizon Europe - Food Hub' },
  { id: 'posti', name: 'POSTI', status: 'active', color: '#8b5cf6', emoji: '⛓️', description: 'Piattaforma tracciabilità blockchain' },
  { id: 'a-grid', name: 'A-GRID', status: 'backlog', color: '#f59e0b', emoji: '🌍', description: 'Carbon farming Emirati - con Guido Mercati' },
  { id: 'consiglio-cibo', name: 'Consiglio del Cibo Roma', status: 'backlog', color: '#ec4899', emoji: '🏛️', description: 'Delegare Simone Cargiani' },
  { id: 'its', name: 'ITS Docenza', status: 'active', color: '#06b6d4', emoji: '🎓', description: 'ITS Firenze + ITS Latina' },
  { id: 'peroni', name: 'Birra Peroni / BEST', status: 'active', color: '#eab308', emoji: '🍺', description: 'Manutenzione + evoluzione BEST' },
  { id: 'olio-roma', name: 'Consorzio Olio di Roma', status: 'backlog', color: '#84cc16', emoji: '🫒', description: 'Monitoraggio e verifica etichette' },
];

const initialTasks: Task[] = [
  // Task attuali da memoria
  { id: '1', text: 'Email a Luigi Saviolo — introdurre Luca Bonacore', projectId: null, priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-01' },
  { id: '2', text: 'Email a Giuseppe Peccentino — Master Carbon Farming', projectId: 'master-cf', priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-01' },
  { id: '3', text: 'All-A-Fly', projectId: null, priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-01' },
  { id: '4', text: 'Firmare contratto CREA', projectId: null, priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-02' },
  { id: '5', text: 'Chiamare Nathan', projectId: null, priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-01-31' },
  { id: '6', text: 'Scrivere all\'AMA — rivedere multa ufficio', projectId: null, priority: 'low', dueDate: null, category: 'admin', completed: false, createdAt: '2026-01-31' },
  { id: '7', text: 'Inarcassa — pagare assicurazione', projectId: null, priority: 'medium', dueDate: null, category: 'admin', completed: false, createdAt: '2026-01-31' },
  { id: '8', text: 'Convenzione RS Management (Master CF)', projectId: 'master-cf', priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-01-30' },
  { id: '9', text: 'Ringraziare Katia (cena Ambasciata Svizzera)', projectId: null, priority: 'low', dueDate: null, category: 'personal', completed: false, createdAt: '2026-01-30' },
  { id: '10', text: 'Simone Cargiani — scarico app Evoluzione', projectId: 'consiglio-cibo', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-01-30' },
  { id: '11', text: 'Conferenza stampa — fissare data Nascenzo + INAIL', projectId: null, priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-01-30' },
];

// ============================================
// HOOKS
// ============================================
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(error);
    }
  }, [key]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// ============================================
// COMPONENTS
// ============================================

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
          className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white backdrop-blur-sm"
        />
        <button
          type="submit"
          className="bg-white hover:bg-white/90 text-purple-700 px-6 py-3 rounded-xl font-medium transition-colors"
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
  onUpdate 
}: { 
  task: Task; 
  projects: Project[];
  onToggle: () => void; 
  onDelete: () => void;
  onUpdate: (updates: Partial<Task>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const project = projects.find(p => p.id === task.projectId);
  
  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const categoryEmoji = {
    work: '💼',
    admin: '📋',
    personal: '👤',
    travel: '✈️',
  };

  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 ${task.completed ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            task.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-green-500'
          }`}
        >
          {task.completed && <span className="text-xs">✓</span>}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className={`text-white ${task.completed ? 'line-through text-gray-500' : ''}`}>
            {task.text}
          </div>
          
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs">{categoryEmoji[task.category]}</span>
            
            <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
              {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '⚪'} {task.priority}
            </span>
            
            {project && (
              <span 
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${project.color}20`, color: project.color, border: `1px solid ${project.color}40` }}
              >
                {project.emoji} {project.name}
              </span>
            )}
            
            {task.dueDate && (
              <span className="text-xs text-gray-400">
                📅 {new Date(task.dueDate).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 p-1 flex-shrink-0"
        >
          🗑️
        </button>
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
  selectedProjectId
}: { 
  title: string;
  status: 'backlog' | 'active' | 'done';
  projects: Project[];
  onMoveProject: (projectId: string, newStatus: 'backlog' | 'active' | 'done') => void;
  onSelectProject: (projectId: string | null) => void;
  selectedProjectId: string | null;
}) {
  const columnProjects = projects.filter(p => p.status === status);
  
  const statusColors = {
    backlog: 'border-white/30 bg-white/10',
    active: 'border-yellow-300/50 bg-yellow-500/10',
    done: 'border-green-300/50 bg-green-500/10',
  };

  return (
    <div className={`rounded-xl border-2 ${statusColors[status]} p-4 min-h-[200px]`}>
      <h3 className="font-bold text-sm uppercase tracking-wide text-gray-300 mb-3">
        {title} ({columnProjects.length})
      </h3>
      
      <div className="space-y-2">
        {columnProjects.map(project => (
          <div
            key={project.id}
            onClick={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
            className={`p-3 rounded-xl cursor-pointer transition-all backdrop-blur-sm ${
              selectedProjectId === project.id 
                ? 'ring-2 ring-white bg-white/30' 
                : 'bg-white/10 hover:bg-white/20'
            }`}
            style={{ borderLeft: `4px solid ${project.color}` }}
          >
            <div className="flex items-center gap-2">
              <span>{project.emoji}</span>
              <span className="font-medium text-sm">{project.name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{project.description}</p>
            
            {/* Move buttons */}
            <div className="flex gap-1 mt-2">
              {status !== 'backlog' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'backlog'); }}
                  className="text-xs px-2 py-1 bg-gray-500/20 hover:bg-gray-500/40 rounded"
                >
                  ← Backlog
                </button>
              )}
              {status !== 'active' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'active'); }}
                  className="text-xs px-2 py-1 bg-blue-500/20 hover:bg-blue-500/40 rounded"
                >
                  🔄 Attivo
                </button>
              )}
              {status !== 'done' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'done'); }}
                  className="text-xs px-2 py-1 bg-green-500/20 hover:bg-green-500/40 rounded"
                >
                  Done ✓
                </button>
              )}
            </div>
          </div>
        ))}
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
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  projects: Project[];
}) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState<'work' | 'admin' | 'personal' | 'travel'>('work');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd({
        text: text.trim(),
        priority,
        category,
        projectId,
        dueDate: dueDate || null,
      });
      setText('');
      setPriority('medium');
      setCategory('work');
      setProjectId(null);
      setDueDate('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Nuovo Task</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Task</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cosa devi fare?"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priorità</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="high">🔴 Alta</option>
                <option value="medium">🟡 Media</option>
                <option value="low">⚪ Bassa</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="work">💼 Lavoro</option>
                <option value="admin">📋 Admin</option>
                <option value="personal">👤 Personale</option>
                <option value="travel">✈️ Viaggio</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Progetto (opzionale)</label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="">Nessun progetto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Scadenza (opzionale)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium"
            >
              Aggiungi
            </button>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4">Nuovo Progetto</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome del progetto"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Descrizione</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrizione"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {emojis.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                    emoji === e ? 'bg-white/20 ring-2 ring-white/50' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Colore</label>
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
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium"
            >
              Crea
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
  const [tasks, setTasks] = useLocalStorage<Task[]>('vm-tasks', initialTasks);
  const [projects, setProjects] = useLocalStorage<Project[]>('vm-projects', initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Quick add task
  const handleQuickAdd = (text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      projectId: selectedProjectId,
      priority: 'medium',
      dueDate: null,
      category: 'work',
      completed: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTasks(prev => [newTask, ...prev]);
  };

  // Add task with details
  const handleAddTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      completed: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTasks(prev => [newTask, ...prev]);
  };

  // Toggle task completion
  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  // Delete task
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Update task
  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    ));
  };

  // Add project
  const handleAddProject = (projectData: Omit<Project, 'id'>) => {
    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
    };
    setProjects(prev => [...prev, newProject]);
  };

  // Move project to different status
  const handleMoveProject = (projectId: string, newStatus: 'backlog' | 'active' | 'done') => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, status: newStatus } : p
    ));
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Filter by completion status
    if (filter === 'active' && task.completed) return false;
    if (filter === 'completed' && !task.completed) return false;
    
    // Filter by project
    if (selectedProjectId && task.projectId !== selectedProjectId) return false;
    
    // Filter by category
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    
    return true;
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === 'high').length;

  return (
    <main 
      className="min-h-screen text-white"
      style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #667eea 100%)',
      }}
    >
      {/* Header */}
      <header className="border-b border-white/20 bg-white/10 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">⚡ SwitchBoard</h1>
              <p className="text-sm text-white/70">Task & Projects</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddTask(true)}
                className="bg-white/20 hover:bg-white/30 border border-white/30 px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm"
              >
                + Task
              </button>
              <button
                onClick={() => setShowAddProject(true)}
                className="bg-white hover:bg-white/90 text-purple-700 px-4 py-2 rounded-xl text-sm font-medium"
              >
                + Progetto
              </button>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-2xl font-bold text-white">{totalTasks - completedTasks}</div>
              <div className="text-xs text-white/70">Da fare</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-2xl font-bold text-yellow-300">{highPriorityTasks}</div>
              <div className="text-xs text-white/70">Priorità alta</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
              <div className="text-2xl font-bold text-green-300">{completedTasks}</div>
              <div className="text-xs text-white/70">Completati</div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-white/20 bg-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-4 py-3">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                activeTab === 'tasks' ? 'bg-white text-purple-700' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              ✅ Task
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                activeTab === 'projects' ? 'bg-white text-purple-700' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              📊 Progetti
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        
        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div>
            {/* Quick Capture */}
            <QuickCapture onAdd={handleQuickAdd} />
            
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex bg-white/5 rounded-lg p-1">
                {(['all', 'active', 'completed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      filter === f ? 'bg-white/20 text-white' : 'text-gray-400'
                    }`}
                  >
                    {f === 'all' ? 'Tutti' : f === 'active' ? 'Attivi' : 'Completati'}
                  </button>
                ))}
              </div>
              
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none"
              >
                <option value="all">Tutte le categorie</option>
                <option value="work">💼 Lavoro</option>
                <option value="admin">📋 Admin</option>
                <option value="personal">👤 Personale</option>
                <option value="travel">✈️ Viaggio</option>
              </select>
              
              {selectedProjectId && (
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-lg text-sm flex items-center gap-1"
                >
                  {projects.find(p => p.id === selectedProjectId)?.emoji} 
                  {projects.find(p => p.id === selectedProjectId)?.name}
                  <span className="ml-1">×</span>
                </button>
              )}
            </div>
            
            {/* Task List */}
            <div className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">🎉</div>
                  <p>Nessun task da mostrare!</p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    projects={projects}
                    onToggle={() => handleToggleTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onUpdate={(updates) => handleUpdateTask(task.id, updates)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* PROJECTS TAB (KANBAN) */}
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
    </main>
  );
}
