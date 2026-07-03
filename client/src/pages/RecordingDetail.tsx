import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Calendar, Clock, HardDrive } from 'lucide-react';
import { recordingService } from '../api/recording.api';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

export default function RecordingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchRecording();
  }, [id]);

  const fetchRecording = async () => {
    try {
      setLoading(true);
      const res = await recordingService.getRecording(id!);
      setRecording(res.data);
    } catch (err) {
      toast.error('Failed to load recording');
      navigate('/recordings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;
    try {
      await recordingService.deleteRecording(id!);
      toast.success('Recording deleted');
      navigate('/recordings');
    } catch (err) {
      toast.error('Failed to delete recording');
    }
  };

  if (loading) return <Loader fullPage={false} label="Loading recording..." />;
  if (!recording) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button 
        onClick={() => navigate('/recordings')}
        className="flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Recordings
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {recording.meetingId?.title || 'Untitled Meeting'}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {new Date(recording.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {Math.floor(recording.duration / 60)}:{(recording.duration % 60).toString().padStart(2, '0')}
            </span>
            <span className="flex items-center font-mono">
              <HardDrive className="w-4 h-4 mr-1" />
              {(recording.sizeBytes / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <a 
            href={recording.url} 
            download 
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-white/5"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
          <button 
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-medium transition-colors border border-red-500/20"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <video 
          controls 
          className="w-full aspect-video outline-none"
          src={recording.url}
          autoPlay
          controlsList="nodownload"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
