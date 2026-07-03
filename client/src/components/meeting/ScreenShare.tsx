import { Monitor, X } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';

const ScreenShare = () => {
  const { isScreenSharing, toggleScreenShare } = useMeetingStore();
  if (!isScreenSharing) return null;
  return (
    <div className="absolute top-2 left-2 z-10">
      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-1.5">
        <Monitor size={14} className="text-green-400" />
        <span className="text-xs text-green-400 font-medium">Screen sharing active</span>
        <button onClick={toggleScreenShare} className="text-green-400 hover:text-red-400 transition-colors">
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default ScreenShare;
