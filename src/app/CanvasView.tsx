'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Task, Project } from '../lib/supabase';

const POSITIONS_KEY = 'switchboard.canvas-positions';
const CARD_W = 220;
const CARD_H = 160;

interface CardPos { x: number; y: number }

function loadPositions(): Record<string, CardPos> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}'); } catch { return {}; }
}

function savePositions(p: Record<string, CardPos>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(p));
}

function defaultPositions(projects: Project[]): Record<string, CardPos> {
  const cols = Math.ceil(Math.sqrt(projects.length + 1));
  const pos: Record<string, CardPos> = {};
  const all = [...projects.map(p => p.id), '__none__'];
  all.forEach((id, i) => {
    pos[id] = { x: (i % cols) * (CARD_W + 40) + 60, y: Math.floor(i / cols) * (CARD_H + 40) + 60 };
  });
  return pos;
}

export default function CanvasView({
  tasks, projects, onMoveTask, onToggleTask, onDeleteTask, onEditTask
}: {
  tasks: Task[];
  projects: Project[];
  onMoveTask: (taskId: string, projectId: string | null) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, CardPos>>({});
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadPositions();
    const ids = [...projects.map(p => p.id), '__none__'];
    const hasAll = ids.every(id => saved[id]);
    if (hasAll) {
      setPositions(saved);
    } else {
      const def = defaultPositions(projects);
      const merged = { ...def, ...saved };
      setPositions(merged);
      savePositions(merged);
    }
  }, [projects]);

  const tasksByProject = useCallback(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of tasks) {
      const arr = map.get(t.project_id) ?? [];
      arr.push(t);
      map.set(t.project_id, arr);
    }
    return map;
  }, [tasks]);

  const cards = [
    ...projects.map(p => ({ id: p.id, label: p.name, emoji: p.emoji, color: p.color })),
    { id: '__none__', label: 'Senza progetto', emoji: '📋', color: '#64748b' },
  ];

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvas) {
      setIsPanning(true);
      setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStart) {
      setPan({ x: panStart.px + (e.clientX - panStart.mx), y: panStart.py + (e.clientY - panStart.my) });
    }
    if (draggingCard && dragStart) {
      const newX = dragStart.cx + (e.clientX - dragStart.mx) / zoom;
      const newY = dragStart.cy + (e.clientY - dragStart.my) / zoom;
      setPositions(prev => {
        const next = { ...prev, [draggingCard]: { x: newX, y: newY } };
        return next;
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingCard) {
      savePositions(positions);
    }
    setIsPanning(false);
    setPanStart(null);
    setDraggingCard(null);
    setDragStart(null);
  };

  const handleCardMouseDown = (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    const pos = positions[cardId];
    if (!pos) return;
    setDraggingCard(cardId);
    setDragStart({ mx: e.clientX, my: e.clientY, cx: pos.x, cy: pos.y });
  };

  const tMap = tasksByProject();

  return (
    <div
      ref={containerRef}
      data-canvas="true"
      className="relative w-full bg-slate-950 rounded-xl border-2 border-slate-700 overflow-hidden select-none"
      style={{ height: 'calc(100vh - 320px)', cursor: isPanning ? 'grabbing' : draggingCard ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Zoom indicator */}
      <div className="absolute top-3 right-3 z-10 flex gap-2 items-center">
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="bg-slate-800 border border-slate-600 text-white w-8 h-8 rounded-lg text-lg font-bold hover:bg-slate-700">+</button>
        <span className="text-slate-400 text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))} className="bg-slate-800 border border-slate-600 text-white w-8 h-8 rounded-lg text-lg font-bold hover:bg-slate-700">−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="bg-slate-800 border border-slate-600 text-white px-2 h-8 rounded-lg text-xs hover:bg-slate-700">Reset</button>
      </div>

      {/* Canvas layer */}
      <div
        data-canvas="true"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}
      >
        {cards.map(card => {
          const pos = positions[card.id];
          if (!pos) return null;
          const cardTasks = tMap.get(card.id === '__none__' ? null : card.id) ?? [];
          const isExpanded = expandedCard === card.id;
          const isDrop = dropTarget === card.id;

          return (
            <div
              key={card.id}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: CARD_W, zIndex: draggingCard === card.id ? 100 : isExpanded ? 50 : 1 }}
              onMouseDown={(e) => handleCardMouseDown(e, card.id)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/task-id')) {
                  e.preventDefault();
                  setDropTarget(card.id);
                }
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                const taskId = e.dataTransfer.getData('application/task-id');
                if (taskId) onMoveTask(taskId, card.id === '__none__' ? null : card.id);
              }}
            >
              {/* Card header */}
              <div
                className={`rounded-xl p-3 transition-all ${isDrop ? 'ring-2 ring-white scale-105' : ''}`}
                style={{ backgroundColor: '#1e293b', borderLeft: `4px solid ${card.color}`, border: isDrop ? `2px solid ${card.color}` : '2px solid #334155' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{card.emoji}</span>
                    <span className="font-semibold text-sm text-white truncate">{card.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono bg-slate-700 px-2 py-0.5 rounded">{cardTasks.length}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedCard(isExpanded ? null : card.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="text-xs text-slate-400 hover:text-white mt-1"
                >
                  {isExpanded ? '▼ Chiudi' : '▶ Mostra task'}
                </button>
              </div>

              {/* Expanded task list */}
              {isExpanded && cardTasks.length > 0 && (
                <div className="mt-1 rounded-xl bg-slate-900/90 border border-slate-700 max-h-[300px] overflow-y-auto" style={{ width: CARD_W }}>
                  {cardTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('application/task-id', task.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`px-3 py-2 border-b border-slate-800 hover:bg-slate-800 cursor-grab active:cursor-grabbing flex items-center gap-2 ${task.completed ? 'opacity-40' : ''}`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleTask(task.id); }}
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${task.completed ? 'bg-green-600 border-green-500 text-white' : 'border-slate-500'}`}
                      >
                        {task.completed ? '✓' : ''}
                      </button>
                      <span className={`text-xs text-white truncate flex-1 ${task.completed ? 'line-through' : ''}`}>{task.text}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-blue-400 text-xs flex-shrink-0"
                      >✏️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
