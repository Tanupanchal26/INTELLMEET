import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Sparkles, ChevronDown, ChevronUp, Calendar, Flag, User } from 'lucide-react';
import { taskService, type Task } from '../../api/task.api';
import { teamService } from '../../api/team.api';
import { aiService } from '../../api/ai.api';
import { useAppSelector } from '../../hooks/useAppDispatch';
import Loader from '../common/Loader';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

type Status = Task['status'];

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: 'backlog',     label: 'Backlog',     color: 'bg-gray-100 text-gray-600' },
  { key: 'todo',        label: 'To Do',       color: 'bg-blue-50 text-blue-600' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-50 text-yellow-700' },
  { key: 'in_review',   label: 'In Review',   color: 'bg-purple-50 text-purple-700' },
  { key: 'done',        label: 'Done',        color: 'bg-green-50 text-green-700' },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600',
  high:   'text-orange-500',
  medium: 'text-yellow-500',
  low:    'text-gray-400',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '🔴 Urgent', high: '🟠 High', medium: '🟡 Medium', low: '⚪ Low',
};

/* ── Task Card ─────────────────────────────────────────────────────────────── */
const TaskCard = ({
  task,
  members,
  onUpdate,
  onDelete,
}: {
  task: Task;
  members: { _id: string; name: string; avatar?: string }[];
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-text)] leading-snug flex-1">{task.title}</p>
        <button onClick={() => onDelete(task._id)} className="text-[var(--color-text-dim)] hover:text-red-500 transition-colors cursor-pointer flex-shrink-0">
          <X size={13} />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.priority && (
          <span className={clsx('text-[10px] font-bold', PRIORITY_COLORS[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
        {task.dueDate && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <Calendar size={10} />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {task.assignedTo && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <User size={10} />
            {task.assignedTo.name}
          </span>
        )}
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="mt-2 text-[10px] text-[var(--color-primary)] flex items-center gap-1 cursor-pointer"
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expanded ? 'Less' : 'Edit'}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-border)] pt-2">
          <select
            value={task.status}
            onChange={e => onUpdate(task._id, { status: e.target.value as Status })}
            className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer"
          >
            {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>

          <select
            value={task.priority ?? 'medium'}
            onChange={e => onUpdate(task._id, { priority: e.target.value as Task['priority'] })}
            className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer"
          >
            {['urgent', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>

          <select
            value={task.assignedTo?._id ?? ''}
            onChange={e => onUpdate(task._id, { assignedTo: (e.target.value || undefined) as any })}
            className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer"
          >
            <option value="">Unassigned</option>
            {members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>

          <input
            type="date"
            value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
            onChange={e => onUpdate(task._id, { dueDate: e.target.value || undefined })}
            className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none"
          />
        </div>
      )}
    </div>
  );
};

/* ── Add Task Form ──────────────────────────────────────────────────────────── */
const AddTaskForm = ({
  status,
  members,
  onAdd,
  onCancel,
}: {
  status: Status;
  members: { _id: string; name: string }[];
  onAdd: (data: Partial<Task>) => void;
  onCancel: () => void;
}) => {
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate]   = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), status, priority, assignedTo: assignee || undefined, dueDate: dueDate || undefined });
    onCancel();
  };

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-primary)]/40 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Task title…"
        className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <div className="flex gap-2">
        <select value={priority ?? 'medium'} onChange={e => setPriority(e.target.value as Task['priority'])}
          className="flex-1 text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer">
          {['urgent', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={assignee} onChange={e => setAssignee(e.target.value)}
          className="flex-1 text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none cursor-pointer">
          <option value="">Unassigned</option>
          {members.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
      </div>
      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
        className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] outline-none" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={!title.trim()}
          className="flex-1 text-xs bg-[var(--color-primary)] text-white rounded-lg py-1.5 font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40">
          Add
        </button>
        <button onClick={onCancel}
          className="flex-1 text-xs border border-[var(--color-border)] rounded-lg py-1.5 text-[var(--color-text-secondary)] hover:bg-black/5 transition-colors cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ── AI Import Panel ────────────────────────────────────────────────────────── */
const AIImportPanel = ({
  teamId,
  onImport,
}: {
  teamId: string;
  onImport: (tasks: Partial<Task>[]) => void;
}) => {
  const [meetingId, setMeetingId] = useState('');
  const [loading, setLoading]     = useState(false);

  const handleImport = async () => {
    if (!meetingId.trim()) return;
    setLoading(true);
    try {
      const res = await aiService.getActionItems(meetingId.trim());
      const items = res.data?.actionItems ?? [];
      if (!items.length) { toast.error('No action items found'); return; }
      const tasks: Partial<Task>[] = items.map((item: any) => ({
        title:    item.text,
        status:   'todo' as Status,
        priority: (item.priority ?? 'medium') as Task['priority'],
        dueDate:  item.dueDate ?? undefined,
        teamId,
      }));
      onImport(tasks);
      setMeetingId('');
      toast.success(`Imported ${tasks.length} action items`);
    } catch {
      toast.error('Failed to fetch action items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
      <Sparkles size={14} className="text-indigo-500 flex-shrink-0" />
      <input
        value={meetingId}
        onChange={e => setMeetingId(e.target.value)}
        placeholder="Meeting ID → import AI action items"
        className="flex-1 text-xs bg-transparent outline-none text-[var(--color-text)] placeholder:text-indigo-300"
      />
      <button
        onClick={handleImport}
        disabled={!meetingId.trim() || loading}
        className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1 font-semibold hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-40"
      >
        {loading ? '…' : 'Import'}
      </button>
    </div>
  );
};

/* ── TeamWorkspace ──────────────────────────────────────────────────────────── */
const TeamWorkspace = () => {
  const { id: teamId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const user = useAppSelector(s => s.auth.user);
  const [addingIn, setAddingIn] = useState<Status | null>(null);

  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamService.getById(teamId!).then((r: any) => r.data),
    enabled: !!teamId,
  });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['team-tasks', teamId],
    queryFn: () => taskService.listByTeam(teamId!).then((r: any) => r.data?.data ?? r.data ?? []),
    enabled: !!teamId,
  });

  const members = (team?.members ?? [])
    .filter((m: any) => m.status === 'active')
    .map((m: any) => ({ _id: m.user._id, name: m.user.name, avatar: m.user.avatar }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['team-tasks', teamId] });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => taskService.createTeamTask(teamId!, data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: ['team-tasks', teamId] });
      const prev = qc.getQueryData<Task[]>(['team-tasks', teamId]);
      qc.setQueryData<Task[]>(['team-tasks', teamId], (old = []) => [
        { _id: `temp-${Date.now()}`, createdAt: new Date().toISOString(), ...data } as Task,
        ...old,
      ]);
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['team-tasks', teamId], ctx.prev);
      toast.error('Failed to create task');
    },
    onSuccess: () => toast.success('Task added'),
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => taskService.updateTeamTask(id, data),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskService.deleteTeamTask(id),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete task'),
  });

  const handleImportAI = (newTasks: Partial<Task>[]) => {
    Promise.all(newTasks.map(t => taskService.createTeamTask(teamId!, t))).then(invalidate);
  };

  if (isLoading) return <Loader fullPage />;

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-bold text-[var(--color-text)]">
          {team?.name ?? 'Team'} — Workspace
        </h2>
        <span className="text-xs text-[var(--color-text-secondary)]">{tasks.length} tasks</span>
      </div>

      <AIImportPanel teamId={teamId!} onImport={handleImportAI} />

      {/* Kanban board */}
      <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto pb-2">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="flex flex-col w-64 flex-shrink-0 bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border)] rounded-2xl overflow-hidden">
              {/* Column header */}
              <div className={clsx('flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]', col.color)}>
                <span className="text-xs font-bold uppercase tracking-wider">{col.label}</span>
                <span className="text-[10px] font-bold bg-white/60 rounded-full px-1.5 py-0.5">{colTasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 scrollbar-thin">
                {colTasks.map(task => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    members={members}
                    onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                    onDelete={id => deleteMutation.mutate(id)}
                  />
                ))}

                {addingIn === col.key ? (
                  <AddTaskForm
                    status={col.key}
                    members={members}
                    onAdd={data => createMutation.mutate(data)}
                    onCancel={() => setAddingIn(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAddingIn(col.key)}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] px-2 py-1.5 rounded-xl hover:bg-black/5 transition-colors cursor-pointer w-full"
                  >
                    <Plus size={13} /> Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamWorkspace;
