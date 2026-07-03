import { Video, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../common/Badge';
import { MEETING_ROUTE } from '../../constants';

const MEETINGS = [
  { _id: 'm1', title: 'Q4 Product Review', startedAt: new Date(Date.now() - 3600000).toISOString(), isActive: true },
  { _id: 'm2', title: 'Design System Sync', startedAt: new Date(Date.now() - 86400000).toISOString(), isActive: false },
  { _id: 'm3', title: 'Backend Architecture', startedAt: new Date(Date.now() - 172800000).toISOString(), isActive: false },
];

const timeAgo = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const MeetingHistory = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-2">
      {MEETINGS.map((m) => (
        <div
          key={m._id}
          onClick={() => navigate(MEETING_ROUTE(m._id))}
          className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.isActive ? 'bg-green-500/15' : 'bg-[var(--color-border)]'}`}>
            <Video size={14} className={m.isActive ? 'text-green-400' : 'text-[var(--color-text-muted)]'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">{m.title}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={10} className="text-[var(--color-text-dim)]" />
              <span className="text-xs text-[var(--color-text-dim)]">{timeAgo(m.startedAt)}</span>
            </div>
          </div>
          {m.isActive ? <Badge variant="success">Live</Badge> : <ArrowRight size={13} className="text-[var(--color-text-dim)]" />}
        </div>
      ))}
    </div>
  );
};

export default MeetingHistory;
