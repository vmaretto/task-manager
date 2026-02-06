'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================
// TYPES
// ============================================
interface Task {
  id: string;
  text: string;
  notes: string;
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
// INITIAL DATA - Aggiornato 06/02/2026
// ============================================
const initialProjects: Project[] = [
  { id: 'master-cf', name: 'Master Carbon Farming', status: 'active', color: '#10b981', emoji: '🌱', description: 'Direttore Operativo - Università della Tuscia' },
  { id: 'switch', name: 'SWITCH', status: 'active', color: '#3b82f6', emoji: '🇪🇺', description: 'Horizon Europe - Food Hub' },
  { id: 'posti', name: 'POSTI', status: 'active', color: '#8b5cf6', emoji: '⛓️', description: 'Piattaforma tracciabilità blockchain' },
  { id: 'a-grid', name: 'A-GRID', status: 'backlog', color: '#f59e0b', emoji: '🌍', description: 'Carbon farming Emirati - con Guido Mercati' },
  { id: 'consiglio-cibo', name: 'Consiglio del Cibo Roma', status: 'active', color: '#ec4899', emoji: '🏛️', description: 'Membro consiglio' },
  { id: 'its', name: 'ITS Docenza', status: 'active', color: '#06b6d4', emoji: '🎓', description: 'ITS Firenze + ITS Latina' },
  { id: 'peroni', name: 'Birra Peroni / BEST', status: 'active', color: '#eab308', emoji: '🍺', description: 'Manutenzione + evoluzione BEST' },
  { id: 'olio-roma', name: 'Consorzio Olio di Roma', status: 'backlog', color: '#84cc16', emoji: '🫒', description: 'Monitoraggio e verifica etichette' },
  { id: 'life', name: 'LIFE Food4Choice', status: 'active', color: '#f43f5e', emoji: '🍎', description: 'Progetto EU LIFE - App riconoscimento cibo' },
  { id: 'tolfa', name: 'Terra Mia Tolfa', status: 'active', color: '#a855f7', emoji: '🏡', description: 'Valorizzazione territoriale Comune di Tolfa' },
];

const initialTasks: Task[] = [
  // === URGENTI ===
  { id: '1', text: 'Convenzione RS Management (Master CF)', notes: 'URGENTE - Da completare prima della conferenza stampa', projectId: 'master-cf', priority: 'high', dueDate: '2026-02-18', category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '2', text: 'Conferenza stampa 18/02 — confermare con Nascenzo + INAIL', notes: '', projectId: 'master-cf', priority: 'high', dueDate: '2026-02-18', category: 'work', completed: false, createdAt: '2026-02-06' },
  
  // === TASK DEL 06/02/2026 ===
  { id: '10', text: 'Far inviare inviti dalla mail di Valentini a Porsia e Katia', notes: '', projectId: 'master-cf', priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '11', text: 'Rispondere alle mail degli studenti', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '12', text: 'Sentire Cruciani per patrocinio Comune di Roma', notes: '', projectId: 'master-cf', priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '13', text: 'Sentire Passerini (dopo call Value for Food) per altre partnership Master', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '14', text: 'Verificare se invitare Sara Roversi (Future Food Institute)', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '15', text: 'Verificare se invitare presidente/rappresentante Unionfood', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '16', text: 'Pagare fatture Tolfa', notes: 'Terra Mia', projectId: 'tolfa', priority: 'high', dueDate: null, category: 'admin', completed: false, createdAt: '2026-02-06' },
  { id: '17', text: 'Firmare documenti LIFE', notes: 'Food4Choice', projectId: 'life', priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '18', text: 'Fattura CREA + DURC', notes: '', projectId: null, priority: 'high', dueDate: null, category: 'admin', completed: false, createdAt: '2026-02-06' },
  { id: '19', text: 'Invitare Istituto Agrario + Ferraiolo', notes: 'Per conferenza stampa/Master', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '20', text: 'Verificare altre aziende Consiglio del Cibo per inviti/partnership', notes: 'Roma', projectId: 'consiglio-cibo', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  
  // === PARTNER MASTER DA CHIUDERE ===
  { id: '30', text: 'Partner Master: Barilla', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '31', text: 'Partner Master: Arsial', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '32', text: 'Partner Master: Comune Roma', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '33', text: 'Partner Master: Banca Intesa', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '34', text: 'Partner Master: Bonifiche Ferraresi', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '35', text: 'Partner Master: Ferrero', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  { id: '36', text: 'Partner Master: Orta', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-06' },
  
  // === ALTRI TASK PRECEDENTI ===
  { id: '40', text: 'Email a Luigi Saviolo — introdurre Luca Bonacore', notes: '', projectId: null, priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-01' },
  { id: '41', text: 'Email a Giuseppe Peccentino — Master Carbon Farming', notes: '', projectId: 'master-cf', priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-01' },
  { id: '42', text: 'Firmare contratto CREA', notes: '', projectId: null, priority: 'high', dueDate: null, category: 'work', completed: false, createdAt: '2026-02-02' },
  { id: '43', text: 'Chiamare Nathan', notes: '', projectId: null, priority: 'medium', dueDate: null, category: 'work', completed: false, createdAt: '2026-01-31' },
  { id: '44', text: 'Scrivere all\'AMA — rivedere multa ufficio', notes: '', projectId: null, priority: 'low', dueDate: null, category: 'admin', completed: false, createdAt: '2026-01-31' },
  { id: '45', text: 'Inarcassa — pagare assicurazione', notes: '', projectId: null, priority: 'medium', dueDate: null, category: 'admin', completed: false, createdAt: '2026-01-31' },
  { id: '46', text: 'Ringraziare Katia (cena Ambasciata Svizzera)', notes: '', projectId: null, priority: 'low', dueDate: null, category: 'personal', completed: false, createdAt: '2026-01-30' },
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
  onToggle: () => void; 
  onDelete: () => void;
  onEdit: () => void;
}) {
  const project = projects.find(p => p.id === task.projectId);
  
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

  return (
    <div className={`bg-slate-800 rounded-xl p-4 border-2 ${task.completed ? 'opacity-50 border-slate-700' : 'border-slate-600'} shadow-lg`}>
      <div className="flex items-start gap-3">
        {/* Checkbox - MOLTO più visibile */}
        <button
          onClick={onToggle}
          className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            task.completed 
              ? 'bg-green-500 border-green-500 text-white' 
              : 'border-white bg-transparent hover:border-green-400 hover:bg-green-500/20'
          }`}
        >
          {task.completed && <span className="text-sm font-bold">✓</span>}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className={`text-white font-medium ${task.completed ? 'line-through text-slate-500' : ''}`}>
            {task.text}
          </div>
          
          {/* Notes */}
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
            
            {task.dueDate && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-md">
                📅 {new Date(task.dueDate).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
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
    backlog: 'border-slate-600 bg-slate-800/50',
    active: 'border-amber-500/50 bg-amber-500/10',
    done: 'border-green-500/50 bg-green-500/10',
  };

  return (
    <div className={`rounded-xl border-2 ${statusColors[status]} p-4 min-h-[200px]`}>
      <h3 className="font-bold text-sm uppercase tracking-wide text-slate-300 mb-3">
        {title} ({columnProjects.length})
      </h3>
      
      <div className="space-y-2">
        {columnProjects.map(project => (
          <div
            key={project.id}
            onClick={() => onSelectProject(selectedProjectId === project.id ? null : project.id)}
            className={`p-3 rounded-xl cursor-pointer transition-all ${
              selectedProjectId === project.id 
                ? 'ring-2 ring-white bg-slate-700' 
                : 'bg-slate-700/50 hover:bg-slate-700'
            }`}
            style={{ borderLeft: `4px solid ${project.color}` }}
          >
            <div className="flex items-center gap-2">
              <span>{project.emoji}</span>
              <span className="font-medium text-sm text-white">{project.name}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description}</p>
            
            {/* Move buttons */}
            <div className="flex gap-1 mt-2">
              {status !== 'backlog' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'backlog'); }}
                  className="text-xs px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded font-medium"
                >
                  ← Backlog
                </button>
              )}
              {status !== 'active' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'active'); }}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded font-medium"
                >
                  🔄 Attivo
                </button>
              )}
              {status !== 'done' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveProject(project.id, 'done'); }}
                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded font-medium"
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
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState<'work' | 'admin' | 'personal' | 'travel'>('work');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setText(task.text);
      setNotes(task.notes || '');
      setPriority(task.priority);
      setCategory(task.category);
      setProjectId(task.projectId);
      setDueDate(task.dueDate || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSave(task.id, {
        text: text.trim(),
        notes: notes.trim(),
        priority,
        category,
        projectId,
        dueDate: dueDate || null,
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
              placeholder="Aggiungi note, dettagli, link..."
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
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  projects: Project[];
}) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
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
        notes: notes.trim(),
        priority,
        category,
        projectId,
        dueDate: dueDate || null,
      });
      setText('');
      setNotes('');
      setPriority('medium');
      setCategory('work');
      setProjectId(null);
      setDueDate('');
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
            <label className="block text-sm text-slate-300 mb-1 font-medium">📝 Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note, dettagli, link..."
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
            <label className="block text-sm text-slate-300 mb-1 font-medium">Progetto (opzionale)</label>
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
            <label className="block text-sm text-slate-300 mb-1 font-medium">Scadenza (opzionale)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-700 border-2 border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none"
            />
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
  const [tasks, setTasks] = useLocalStorage<Task[]>('vm-tasks-v2', initialTasks);
  const [projects, setProjects] = useLocalStorage<Project[]>('vm-projects-v2', initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Quick add task
  const handleQuickAdd = (text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      text,
      notes: '',
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

  // Sort tasks: high priority first
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === 'high').length;

  return (
    <main className="min-h-screen text-white bg-slate-900">
      {/* Header */}
      <header className="border-b-2 border-slate-700 bg-slate-800 sticky top-0 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">⚡ SwitchBoard</h1>
              <p className="text-sm text-slate-400">Task & Projects</p>
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
        
        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div>
            {/* Quick Capture */}
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
              
              {selectedProjectId && (
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="bg-blue-500/20 text-blue-400 border-2 border-blue-500/40 px-3 py-1 rounded-lg text-sm flex items-center gap-1 font-medium"
                >
                  {projects.find(p => p.id === selectedProjectId)?.emoji} 
                  {projects.find(p => p.id === selectedProjectId)?.name}
                  <span className="ml-1">×</span>
                </button>
              )}
            </div>
            
            {/* Task List */}
            <div className="space-y-3">
              {sortedTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-4">🎉</div>
                  <p>Nessun task da mostrare!</p>
                </div>
              ) : (
                sortedTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    projects={projects}
                    onToggle={() => handleToggleTask(task.id)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onEdit={() => setEditingTask(task)}
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
      
      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSave={handleUpdateTask}
        projects={projects}
      />
    </main>
  );
}
