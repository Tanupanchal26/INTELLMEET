import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Calendar, Clock, HardDrive } from 'lucide-react';
import { recordingService } from '../api/recording.api';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;

export default function RecordingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res: any = await recordingService.getRecording(id);
        setRecording(res?.data ?? res);
      } catch {
        toast.error('Failed to load recording');
        navigate('/recordings');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!window.confirm('Delete this recording? This cannot be undone.')) return;
    try {
      await recordingService.deleteRecording(id!);
      toast.success('Recording deleted');
      navigate('/recordings');
    } catch {
      toast.error('Failed to delete recording');
    }
  };

  if (loading) return <Loader fullPage={false} label="Loading recording…" />;
  if (!recording) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-[var(--color-text)]">
      <button
        onClick={() => navigate('/recordings')}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Recordings
      </button>

      {/* Title + actions */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {recording.meetingId?.title || 'Untitled Meeting'}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              {new Date(recording.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {fmtDuration(recording.duration ?? 0)}
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <HardDrive size={13} />
              {((recording.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={recording.url}
            download
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] rounded-xl font-medium text-sm transition-colors border border-[var(--color-border)]"
          >
            <Download size={14} />
            Download
          </a>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-medium text-sm transition-colors border border-red-500/20"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Video player */}
      <div className="bg-black rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-2xl">
        {recording.status === 'processing' ? (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)]">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Processing recording…</p>
          </div>
        ) : recording.status === 'failed' ? (
          <div className="aspect-video flex items-center justify-center text-red-400 text-sm">
            Recording processing failed.
          </div>
        ) : (
          <video
            controls
            autoPlay={false}
            className="w-full aspect-video outline-none"
            src={recording.url}
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
    </div>
  );
}
