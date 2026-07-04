import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronUp, ChevronDown, X, Users, Clock, Brain, CheckSquare, FileText, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { meetingService } from '../api/meeting.api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

type SortBy = 'endedAt' | 'startedAt' | 'title' | 'duration';
type Order  = 'asc' | 'desc';

interface Participant { _id: string; name: string; avatar?: string; email?: string }
interface ActionItem  { _id: string; text: string; assignee?: string; dueDate?: string; priority?: string; status?: string }
interface Decision    { _id: string; text: string; type?: string; owner?: string }
interface AI          { summary?: string; actionItems?: ActionItem[]; decisions?: Decision[]; transcript?: string; processingStatus?: string }
interface Recording   { url?: string; duration?: number; sizeBytes?: number }
interface Meeting {
  _id: string; title: string; startedAt?: string; endedAt?: string; duration: number;
  participants: Participant[]; host?: Participant; ai?: AI; recording?: Recording;
}

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dur = (min: number) => min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;

function SortBtn({ field, current, order, onClick }: { field: SortBy; current: SortBy; order: Order; onClick: () => void }) {
  const active = field === current;
  return (
    <button onClick={onClick} className={clsx('flex items-center gap-1 text-xs font-700 transition-colors', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]')}>
      {field.charAt(0).toUpperCase() + field.slice(1)}
      {active ? (order === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />}
    </button>
  );
}

function DetailModal({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'decisions' | 'actions' | 'transcript'>('summary');
  const ai = meeting.ai;
  const tabs = [
    { id: 'summary',    label: 'Summary',      icon: Brain },
    { id: 'decisions',  label: 'Decisions',    icon: CheckSquare },
    { id: 'actions',    label: 'Action Items', icon: FileText },
    { id: 'transcript', label: 'Transcript',   icon: FileText },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="db-card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="db-card-header flex-shrink-0">
          <div className="db-card-header-left min-w-0">
            <span className="db-card-title truncate">{meeting.title}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"><X size={16} /></button>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 px-6 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex-shrink-0">
          <span className="flex items-center gap-1"><Clock size={12} />{fmt(meeting.endedAt)}</span>
          <span className="flex items-center gap-1"><Clock size={12} />{dur(meeting.duration)}</span>
          <span className="flex items-center gap-1"><Users size={12} />{meeting.participants.length} participants</span>
          {meeting.recording && <span className="flex items-center gap-1 text-rose-500"><Film size={12} />Recording available</span>}
        </div>

        {/* Participants */}
        <div className="px-6 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <p className="text-xs font-700 text-[var(--color-text-secondary)] mb-2">Participants</p>
          <div className="flex flex-wrap gap-2">
            {meeting.participants.map(p => (
              <span key={p._id} className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)]">{p.name}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-700 transition-colors',
                tab === id ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]')}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-[var(--color-text)]">
          {tab === 'summary' && (
            ai?.summary
              ? <p className="leading-relaxed whitespace-pre-wrap">{ai.summary}</p>
              : <p className="text-[var(--color-text-secondary)] text-xs">No AI summary available.</p>
          )}
          {tab === 'decisions' && (
            ai?.decisions?.length
              ? <ul className="space-y-2">{ai.decisions.map(d => (
                  <li key={d._id} className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <span className={clsx('mt-0.5 w-2 h-2 rounded-full flex-shrink-0', d.type === 'approved' ? 'bg-emerald-500' : d.type === 'rejected' ? 'bg-red-500' : 'bg-amber-500')} />
                    <span className="text-xs leading-relaxed">{d.text}</span>
                  </li>
                ))}</ul>
              : <p className="text-[var(--color-text-secondary)] text-xs">No decisions recorded.</p>
          )}
          {tab === 'actions' && (
            ai?.actionItems?.length
              ? <ul className="space-y-2">{ai.actionItems.map(a => (
                  <li key={a._id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <CheckSquare size={14} className={clsx('mt-0.5 flex-shrink-0', a.status === 'done' ? 'text-emerald-500' : 'text-[var(--color-text-secondary)]')} />
                    <div className="min-w-0">
                      <p className="text-xs leading-relaxed">{a.text}</p>
                      {a.assignee && <p className="text-xs text-[var(--color-text-secondary)] mt-1">→ {a.assignee}</p>}
                    </div>
                    {a.priority && <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full flex-shrink-0', a.priority === 'high' ? 'bg-red-500/10 text-red-500' : a.priority === 'medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500')}>{a.priority}</span>}
                  </li>
                ))}</ul>
              : <p className="text-[var(--color-text-secondary)] text-xs">No action items.</p>
          )}
          {tab === 'transcript' && (
            ai?.transcript
              ? <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border)] overflow-x-auto">{ai.transcript}</pre>
              : <p className="text-[var(--color-text-secondary)] text-xs">No transcript available.</p>
          )}
        </div>

        {/* Recording link */}
        {meeting.recording?.url && (
          <div className="px-6 py-3 border-t border-[var(--color-border)] flex-shrink-0">
            <a href={meeting.recording.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-700 text-rose-500 hover:underline">
              <Film size={13} />View Recording
              {meeting.recording.sizeBytes && <span className="text-[var(--color-text-secondary)] font-500">({(meeting.recording.sizeBytes / 1024 / 1024).toFixed(1)} MB)</span>}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PostMeetingDashboard() {
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState<SortBy>('endedAt');
  const [order,   setOrder]   = useState<Order>('desc');
  const [page,    setPage]    = useState(1);
  const [selected, setSelected] = useState<Meeting | null>(null);

  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['completed-meetings', page, limit, search, sortBy, order],
    queryFn: () => meetingService.getCompleted({ page, limit, search: search || undefined, sortBy, order })
      .then((r: any) => r?.data ?? r),
    placeholderData: (prev: any) => prev,
  });

  const meetings: Meeting[] = data?.data ?? [];
  const meta = { total: data?.total ?? 0, totalPages: data?.totalPages ?? 1, hasNext: data?.hasNext ?? false, hasPrev: data?.hasPrev ?? false };

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) setOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setOrder('desc'); }
    setPage(1);
  };

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <PageContainer className="db-container">
      <PageHeader title="Post-Meeting Dashboard" subtitle="Review completed meetings, AI summaries, decisions and action items." />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6 mt-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search meetings…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          {search && <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={12} className="text-[var(--color-text-secondary)]" /></button>}
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
          <span className="text-[var(--color-text-secondary)] font-600">Sort:</span>
          {(['endedAt', 'title', 'duration'] as SortBy[]).map(f => (
            <SortBtn key={f} field={f} current={sortBy} order={order} onClick={() => toggleSort(f)} />
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{meta.total} meetings</span>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="db-card animate-pulse h-20" />)}
        </div>
      ) : meetings.length === 0 ? (
        <div className="db-card flex items-center justify-center py-16 text-[var(--color-text-secondary)] text-sm">
          No completed meetings found.
        </div>
      ) : (
        <div className="db-card overflow-hidden">
          {meetings.map((m, i) => (
            <button key={m._id} onClick={() => setSelected(m)}
              className={clsx('w-full flex items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[var(--color-surface-2)]',
                i < meetings.length - 1 && 'border-b border-[var(--color-border)]')}>
              {/* Title + date */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-700 text-[var(--color-text)] truncate">{m.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{fmt(m.endedAt)}</p>
              </div>
              {/* Duration */}
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                <Clock size={12} />{dur(m.duration)}
              </span>
              {/* Participants */}
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                <Users size={12} />{m.participants.length}
              </span>
              {/* AI badge */}
              <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                m.ai?.summary ? 'bg-purple-500/10 text-purple-500' : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]')}>
                <Brain size={11} />{m.ai?.summary ? 'AI' : 'No AI'}
              </span>
              {/* Recording badge */}
              {m.recording && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 flex-shrink-0"><Film size={11} />Rec</span>}
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button disabled={!meta.hasPrev} onClick={() => setPage(p => p - 1)}
            className="p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40 hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-[var(--color-text-secondary)]">Page {page} of {meta.totalPages}</span>
          <button disabled={!meta.hasNext} onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] disabled:opacity-40 hover:bg-[var(--color-surface-2)] transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {selected && <DetailModal meeting={selected} onClose={() => setSelected(null)} />}
    </PageContainer>
  );
}
