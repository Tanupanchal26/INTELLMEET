import { useRef, useState } from 'react';
import { Search, Menu, Plus, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../hooks/useAppDispatch';
import { setMobileSidebar } from '../../store/ui/ui.slice';
import NotificationCenter from '../common/NotificationCenter';
import { ROUTES } from '../../constants';

interface Props { title?: string; }

const TopBar = ({ title }: Props) => {
  const user          = useAppSelector((s) => s.auth.user);
  const dispatch      = useAppDispatch();
  const navigate      = useNavigate();
  const initial       = user?.name?.charAt(0).toUpperCase() ?? 'U';
  const inputRef      = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <header
      role="banner"
      className="flex items-center justify-between h-16 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 md:px-6 lg:px-8 shrink-0 gap-4 w-full"
    >
      {/* Left: mobile toggle + page title */}
      <div className="flex items-center gap-4 shrink-0 min-w-0">
        <button
          onClick={() => dispatch(setMobileSidebar(true))}
          className="md:hidden p-2 -ml-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors active:scale-95 cursor-pointer"
          aria-label="Open navigation menu"
          aria-haspopup="true"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {title && (
          <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight hidden sm:block truncate max-w-[200px]">
            {title}
          </h1>
        )}
      </div>

      {/* Center: search */}
      <div className="flex-1 max-w-md mx-auto px-4 hidden sm:block">
        <div className="relative w-full transition-all duration-200 group">
          <Search
            size={16}
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none ${focused ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)] group-hover:text-[var(--color-text-muted)]'}`}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            placeholder="Search meetings, tasks, people…"
            aria-label="Search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={`
              w-full h-10 pl-11 pr-14 rounded-full text-sm font-medium
              bg-[var(--color-surface-2)] border border-[var(--color-border)] transition-all duration-200 outline-none
              text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]
              ${focused
                ? 'border-[var(--color-primary)] shadow-[0_0_0_3px_var(--color-primary-light)]'
                : 'hover:border-[var(--color-border-strong)]'
              }
            `}
          />
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
            aria-hidden="true"
          >
            {focused ? (
              <kbd className="flex items-center text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">
                ESC
              </kbd>
            ) : (
              <kbd className="flex items-center text-xs text-[var(--color-text-secondary)] font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5 shadow-sm">
                ⌘K
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3 md:gap-4 shrink-0" role="toolbar" aria-label="Header actions">
        <NotificationCenter />

        <button
          onClick={() => navigate(ROUTES.SETTINGS + '?tab=profile')}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold bg-[var(--color-primary)] shadow-sm transition-all hover:ring-4 hover:ring-[var(--color-primary)]/10 active:scale-95 cursor-pointer border border-[var(--color-border)]"
          aria-label={`View profile for ${user?.name ?? 'User'}`}
        >
          <span aria-hidden="true">{initial}</span>
        </button>

        <button
          onClick={() => navigate(ROUTES.LOBBY)}
          className="hidden lg:flex items-center gap-2 text-sm font-semibold text-white bg-[var(--color-primary)] rounded-xl px-5 h-10 shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 cursor-pointer border border-[var(--color-border)]"
          aria-label="Start a new meeting"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          New Meeting
        </button>

        <button
          onClick={() => navigate(ROUTES.LOBBY)}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 transition-all active:scale-[0.98] cursor-pointer border border-[var(--color-border)]/10"
          aria-label="New meeting"
        >
          <Video size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
