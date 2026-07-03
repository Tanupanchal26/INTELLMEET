import { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, FileText, FileImage, FileVideo, File, 
  Trash2, Download, ExternalLink, Loader2, AlertCircle 
} from 'lucide-react';
import { mediaService } from '../api/media.api';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

export default function MediaLibrary() {
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Media Library | IntellMeet';
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await mediaService.getMedia();
      setMediaList(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    // 10MB Limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds the 10MB limit');
      return;
    }

    try {
      setUploading(true);
      const res = await mediaService.uploadMedia(file);
      toast.success('Media uploaded successfully!');
      setMediaList([res.data, ...mediaList]);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this media file?')) return;

    try {
      await mediaService.deleteMedia(id);
      toast.success('Media deleted successfully');
      setMediaList(mediaList.filter(m => m._id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete media');
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'image':
        return <FileImage className="w-8 h-8 text-indigo-400" />;
      case 'video':
        return <FileVideo className="w-8 h-8 text-emerald-400" />;
      default:
        return <FileText className="w-8 h-8 text-amber-400" />;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-[var(--color-text)] font-sans">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">Media Library</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Upload and manage media references securely on the server.</p>
      </div>

      {/* Upload Zone */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer select-none bg-[var(--color-surface-2)]/40
          ${dragOver 
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 scale-[1.01]' 
            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]'
          }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,application/pdf,text/plain,.doc,.docx"
        />
        
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
            <p className="text-sm font-semibold text-[var(--color-text)]">Uploading file to secure servers...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center">
              <UploadCloud className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text)]">Click to upload or drag & drop files</p>
              <p className="text-xs text-[var(--color-text-dim)] mt-1">Supports Images, Videos, PDF, Word, and Text documents up to 10MB</p>
            </div>
          </>
        )}
      </div>

      {/* Media Grid */}
      {loading ? (
        <Loader fullPage={false} label="Loading library..." />
      ) : mediaList.length === 0 ? (
        <div className="text-center py-20 bg-[var(--color-surface-hover)] rounded-2xl border border-[var(--color-border-subtle)] flex flex-col items-center justify-center gap-3">
          <File className="w-14 h-14 text-[var(--color-text-dim)]" />
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Your Media Library is empty</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Upload files to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mediaList.map((media) => (
            <div 
              key={media._id}
              className="group relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all flex flex-col"
            >
              {/* Media Preview/Thumbnail */}
              <div className="aspect-[4/3] bg-black/80 relative flex items-center justify-center border-b border-[var(--color-border-subtle)]">
                {media.resourceType === 'image' ? (
                  <img 
                    src={media.url} 
                    alt={media.fileName}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                ) : media.resourceType === 'video' ? (
                  <video 
                    src={media.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex items-center justify-center shadow-lg">
                    {getFileIcon(media.resourceType)}
                  </div>
                )}
                
                {/* Floating overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <a 
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text)] transition-colors"
                    title="View Original"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <a 
                    href={media.url}
                    download={media.fileName}
                    className="w-9 h-9 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text)] transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => handleDelete(media._id)}
                    className="w-9 h-9 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/20 flex items-center justify-center text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Media details card info */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                <div className="min-w-0">
                  <h4 className="font-semibold text-[13px] truncate text-[var(--color-text)]" title={media.fileName}>
                    {media.fileName}
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-1">
                    Uploaded by {media.uploadedBy?.name || 'Unknown'}
                  </p>
                </div>
                
                <div className="flex justify-between items-center text-[10.5px] text-[var(--color-text-dim)] font-mono pt-3.5 border-t border-[var(--color-border-subtle)]">
                  <span>{formatBytes(media.fileSize)}</span>
                  <span>{new Date(media.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
