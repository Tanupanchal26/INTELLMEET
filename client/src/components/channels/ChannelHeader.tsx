import { Lock } from 'lucide-react';
import Button from '../../components/common/Button';
import type { Channel } from '../../api/team.api';

interface ChannelHeaderProps {
  channel: Channel;
  isAdmin: boolean;
  onBack?: () => void;
}

export const ChannelHeader: React.FC<ChannelHeaderProps> = ({ channel, isAdmin, onBack }) => {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 backdrop-blur-md flex-shrink-0">
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-black/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          {/* Reusing ChevronLeft icon via Button's default icon prop is optional */}
          <Lock size={15} /> {/* Placeholder; replace with appropriate icon if needed */}
        </Button>
      )}
      <div className="flex-1">
        <p className="font-bold text-[var(--color-text)] text-sm">{channel.name}</p>
        {channel.description && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{channel.description}</p>
        )}
      </div>
      {isAdmin && (
        <Button variant="secondary" onClick={() => {/* open create channel modal handled in parent */}}
          className="p-1 rounded-lg hover:bg-black/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          {/* Plus icon */}
          <Lock size={13} />
        </Button>
      )}
    </div>
  );
};
