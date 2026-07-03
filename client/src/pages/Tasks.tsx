import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, GripVertical, Calendar, Trash2 } from 'lucide-react';
import { taskService, type Task } from '../api/task.api';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Card from '../components/common/Card';
import toast from 'react-hot-toast';

type Status = 'todo' | 'in_progress' | 'done';

const COLS: { id: Status; label: string; color: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'bg-[#AAAFAF]' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-[#AFA9B4]' },
  { id: 'done',        label: 'Done',        color: 'bg-emerald-500' },
];

const PRIORITY_V: Record<string, 'danger' | 'warning' | 'info'> = {
  high: 'danger', medium: 'warning', low: 'info',
};

/* ─── TaskCard ─────────────────────────────────────────────────────────────── */
const TaskCard = ({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-xl p-4 flex flex-col gap-3 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:shadow-md transition-all duration-200 group cursor-grab active:cursor-grabbing shadow-[0_2px_8px_rgba(66,67,65,0.02)]"
    >
      <div className="flex items-start gap-2">
        <div
          {...listeners} {...attributes}
          className="cursor-grab mt-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-text-muted)] flex-shrink-0"
        >
          <GripVertical size={14} />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text)] flex-1 leading-snug">{task.title}</p>
        <button
          onClick={() => onDelete(task._id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-dim)] hover:text-red-600 transition-all cursor-pointer"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex items-center justify-between pl-5">
        {task.priority && (
          <Badge variant={PRIORITY_V[task.priority]} className="capitalize">{task.priority}</Badge>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {task.assignedTo && (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm border border-indigo-400/20">
              {task.assignedTo.name.charAt(0)}
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-1">
              <Calendar size={10} className="text-[var(--color-text-dim)]" />
              <span className="text-[10px] text-[var(--color-text-dim)]">
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Tasks (Kanban) ────────────────────────────────────────────────────────── */
const Tasks = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', status: 'todo' as Status });
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => taskService.list().then((r: any) => r?.data ?? r ?? []),
    staleTime: 30_000,
  });

  /* ── optimistic update helper ── */
  const optimisticUpdate = (updated: Task[]) =>
    qc.setQueryData<Task[]>(['tasks'], updated);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      taskService.update(id, data),
    onError: (_err, _vars, ctx: any) => {
      // rollback
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
      toast.error('Failed to move task — reverted');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskService.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], (old = []) => old.filter(t => t._id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
      toast.error('Failed to delete task');
    },
    onSuccess: () => toast.success('Task removed'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => taskService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
      setNewTask({ title: '', priority: 'medium', status: 'todo' });
      setShowCreate(false);
    },
    onError: () => toast.error('Failed to create task'),
  });

  /* ── DnD handlers ── */
  const handleDragStart = ({ active }: DragStartEvent) =>
    setActiveId(active.id as string);

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeTask = tasks.find(t => t._id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const overCol = COLS.find(c => c.id === overId);

    // dragged over a column droppable (not a card) → cross-column
    if (overCol && activeTask.status !== overCol.id) {
      optimisticUpdate(
        tasks.map(t => t._id === activeTask._id ? { ...t, status: overCol.id } : t)
      );
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const currentTasks = qc.getQueryData<Task[]>(['tasks']) ?? tasks;
    const activeTask   = currentTasks.find(t => t._id === active.id);
    const overTask     = currentTasks.find(t => t._id === over.id);
    const overCol      = COLS.find(c => c.id === over.id);

    if (!activeTask) return;
    const prev = [...currentTasks];

    if (overCol) {
      // dropped onto a column — status change only
      if (activeTask.status !== overCol.id) {
        optimisticUpdate(
          currentTasks.map(t => t._id === activeTask._id ? { ...t, status: overCol.id } : t)
        );
        updateMutation.mutate(
          { id: activeTask._id, data: { status: overCol.id } },
          { onError: () => qc.setQueryData(['tasks'], prev) }
        );
      }
    } else if (overTask) {
      if (activeTask.status === overTask.status) {
        // ── same-column reorder ──────────────────────────────────────────────
        const colTasks  = currentTasks.filter(t => t.status === activeTask.status);
        const oldIndex  = colTasks.findIndex(t => t._id === active.id);
        const newIndex  = colTasks.findIndex(t => t._id === over.id);
        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        const next      = currentTasks.map(t =>
          t.status === activeTask.status
            ? reordered[reordered.findIndex(r => r._id === t._id)] ?? t
            : t
        );
        // rebuild preserving order
        const colIds  = reordered.map(t => t._id);
        const others  = currentTasks.filter(t => t.status !== activeTask.status);
        const ordered = [...reordered, ...others];
        optimisticUpdate(ordered);
      } else {
        // ── cross-column drop onto a card ────────────────────────────────────
        optimisticUpdate(
          currentTasks.map(t =>
            t._id === activeTask._id ? { ...t, status: overTask.status } : t
          )
        );
        updateMutation.mutate(
          { id: activeTask._id, data: { status: overTask.status } },
          { onError: () => qc.setQueryData(['tasks'], prev) }
        );
      }
    }
  };

  const activeTask = activeId ? (qc.getQueryData<Task[]>(['tasks']) ?? tasks).find(t => t._id === activeId) : null;

  /* ── Skeleton ── */
  if (isLoading) return (
    <div className="flex flex-col gap-8 h-full">
      <div className="h-8 w-48 bg-white/20 animate-pulse rounded-lg" />
      <div className="grid grid-cols-3 gap-6 flex-1">
        {[0, 1, 2].map(i => <div key={i} className="bg-white/20 rounded-2xl h-96 animate-pulse" />)}
      </div>
    </div>
  );

  const liveTasks = qc.getQueryData<Task[]>(['tasks']) ?? tasks;

  return (
    <div className="flex flex-col gap-5 animate-fade-in h-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Task Board</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{liveTasks.length} tasks across all columns</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={15} /> Add Task</Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          {COLS.map(col => {
            const colTasks = liveTasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <span className="text-sm font-bold text-[var(--color-text)]">{col.label}</span>
                  <span className="ml-auto text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-full px-2 py-0.5 font-bold">
                    {colTasks.length}
                  </span>
                </div>
                {/* Column is also a droppable target via its id */}
                <SortableContext
                  id={col.id}
                  items={colTasks.map(t => t._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    id={col.id}
                    className="kanban-col flex flex-col gap-2.5 bg-white/30 backdrop-blur-md rounded-2xl p-3 border border-[var(--color-border)] min-h-[420px] transition-all duration-300 hover:bg-white/40"
                  >
                    {colTasks.map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="flex-1 flex items-center justify-center h-40 border border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-muted)] font-medium select-none">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="bg-[var(--color-surface-hover)] border border-[var(--color-border-strong)] rounded-xl p-4 text-sm font-bold text-[var(--color-text)] shadow-2xl rotate-1 backdrop-blur-md">
              {activeTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">Task Title *</label>
            <input
              value={newTask.title}
              onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Review API documentation"
              className="input-light"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">Priority</label>
              <select
                value={newTask.priority}
                onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                className="input-light"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--color-text-secondary)] block mb-1.5">Column</label>
              <select
                value={newTask.status}
                onChange={e => setNewTask(p => ({ ...p, status: e.target.value as Status }))}
                className="input-light"
              >
                {COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => { if (newTask.title.trim()) createMutation.mutate(newTask); }} loading={createMutation.isPending}>
              Create Task
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Tasks;
