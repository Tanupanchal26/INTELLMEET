import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Video, Play, Trash2, Download, RefreshCw } from 'lucide-react';
import { recordingService } from '../api/recording.api';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

const fmtSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    ready:      'bg-green-500/15 text-green-400 border-green-500/30',
    processing: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    failed:     'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? map.processing}`}>
      {status}
    </span>
  );
};

export default function Recordings() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting]     = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await recordingService.getRecordings();
      const list = res?.data ?? res ?? [];
      setRecordings(Array.isArray(list) ? list : []);
    } catch {
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this recording? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await recordingService.deleteRecording(id);
      toast.success('Recording deleted');
      setRecordings(prev => prev.filter(r => r._id !== id));
    } catch {
      toast.error('Failed to delete recording');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = recordings.filter(r =>
    (r.meetingId?.title ?? 'Untitled').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--color-text)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recordings</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={fetchRecordings}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
          aria-label="Refresh recordings"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          placeholder="Search by meeting title…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {/* Content */}
      {loading ? (
        <Loader fullPage={false} label="Loading recordings…" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[var(--color-surface-hover)] rounded-2xl border border-[var(--color-border-subtle)]">
          <Video className="w-14 h-14 text-[var(--color-text-dim)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">
            {searchTerm ? 'No recordings match your search' : 'No recordings yet'}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {searchTerm ? 'Try a different search term.' : 'Start a meeting and hit Record to save it here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((rec) => (
            <div
              key={rec._id}
              onClick={() => navigate(`/recordings/${rec._id}`)}
              className="group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-[var(--color-primary)]/50 hover:shadow-lg transition-all cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-black relative flex items-center justify-center">
                <Video className="w-10 h-10 text-slate-700" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-11 h-11 rounded-full bg-[var(--color-primary)] flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur text-xs font-mono text-white rounded-md">
                  {fmtDuration(rec.duration ?? 0)}
                </div>
                {/* Status badge */}
                <div className="absolute top-2 left-2">
                  <StatusBadge status={rec.status ?? 'ready'} />
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-[var(--color-text)] truncate mb-2">
                  {rec.meetingId?.title || 'Untitled Meeting'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(rec.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                  <span className="font-mono">{fmtSize(rec.sizeBytes ?? 0)}</span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
                  <a
                    href={rec.url}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-primary)] transition-colors"
                    title="Download"
                    aria-label="Download recording"
                  >
                    <Download size={15} />
                  </a>
                  <button
                    onClick={(e) => handleDelete(e, rec._id)}
                    disabled={deleting === rec._id}
                    className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                    title="Delete"
                    aria-label="Delete recording"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
