import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, CheckCheck, Video, Users, AtSign, CheckSquare, Info, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { notificationService, type Notification } from '../../api/notification.api';
import { clsx } from 'clsx';

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

const ICONS: Record<string, React.ElementType> = {
  meeting_invite: Video, meeting_started: Video, meeting_ended: Video, meeting_reminder: Video,
  team_invite: Users, team_role_changed: Users,
  channel_mention: AtSign, message_reply: AtSign,
  task_assigned: CheckSquare, task_due: CheckSquare,
  ai_summary_ready: Sparkles, action_item_assigned: CheckSquare,
  system: Info,
};

const ICON_STYLE: Record<string, string> = {
  meeting_invite:       'bg-blue-50 text-blue-600',
  meeting_started:      'bg-emerald-50 text-emerald-600',
  meeting_ended:        'bg-gray-100 text-gray-500',
  meeting_reminder:     'bg-amber-50 text-amber-600',
  team_invite:          'bg-blue-50 text-blue-600',
  team_role_changed:    'bg-orange-50 text-orange-600',
  channel_mention:      'bg-purple-50 text-purple-600',
  message_reply:        'bg-purple-50 text-purple-600',
  task_assigned:        'bg-blue-50 text-blue-600',
  task_due:             'bg-red-50 text-red-600',
  ai_summary_ready:     'bg-indigo-50 text-indigo-600',
  action_item_assigned: 'bg-teal-50 text-teal-600',
  system:               'bg-gray-100 text-gray-500',
};

const getDeepLink = (n: Notification): string | null => {
  if (n.link) return n.link;
  if (n.refModel === 'Meeting' && n.refId) {
    if (n.type === 'ai_summary_ready') return `/ai-summary/${n.refId}`;
    if (n.type === 'action_item_assigned') return `/ai-summary/${n.refId}?tab=action-items`;
    return `/lobby?join=${n.refId}`;
  }
  if (n.refModel === 'Task' && n.refId) return `/tasks?highlight=${n.refId}`;
  if (n.refModel === 'Team' && n.refId) return `/teams/${n.refId}`;
  return null;
};

const PANEL_ANIM = {
  hidden:  { opacity: 0, scale: 0.97, y: -6 },
  visible: { opacity: 1, scale: 1,    y: 0  },
  exit:    { opacity: 0, scale: 0.97, y: -4 },
};

const NotificationCenter = () => {
  const [open, setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef   = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { socket } = useSocket();
  const navigate   = useNavigate();

  const unread = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    notificationService.list({ limit: 25 })
      .then((r: any) => setNotifications(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket.current?.on) return;
    const onNew = (notif: Notification) => setNotifications(prev => [notif, ...prev]);
    socket.current.on('notification:new', onNew);
    return () => { socket.current!.off('notification:new', onNew); };
  }, []); // socket is a stable ref — safe to omit

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    await notificationService.markRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };
  const dismiss = async (id: string) => {
    await notificationService.delete(id).catch(() => {});
    setNotifications(prev => prev.filter(n => n._id !== id));
  };
  const markAll = async () => {
    await notificationService.markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleNotifClick = async (n: Notification) => {
    if (!n.isRead) await markRead(n._id);
    const link = getDeepLink(n);
    if (link) { setOpen(false); navigate(link); }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'relative w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-150 active:scale-95 cursor-pointer outline-none',
          open
            ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border-[var(--color-border-strong)]'
            : 'text-[var(--color-text-secondary)] bg-white/45 border-[var(--color-border)] hover:bg-white/60 hover:border-[var(--color-border-strong)]'
        )}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-primary)] text-white text-[9px] flex items-center justify-center font-bold shadow-sm"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="absolute right-0 top-[calc(100%+6px)] w-[360px] bg-white rounded-2xl border border-gray-200 shadow-[0_20px_40px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden"
            style={{ zIndex: 99999 }}
            variants={PANEL_ANIM}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            role="region"
            aria-label="Notification panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-semibold">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Bell size={18} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">All caught up</p>
                  <p className="text-xs text-gray-400">No new notifications</p>
                </div>
              ) : (
                <div>
                  {notifications.map((n, i) => {
                    const Icon = ICONS[n.type] ?? Info;
                    const iconStyle = ICON_STYLE[n.type] ?? 'bg-gray-100 text-gray-500';
                    return (
                      <motion.div
                        key={n._id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={clsx(
                          'flex items-start gap-3 px-5 py-3.5 group transition-colors relative',
                          'border-b border-gray-50 last:border-0',
                          n.isRead
                            ? 'hover:bg-gray-50'
                            : 'bg-blue-50/40 hover:bg-blue-50/60'
                        )}
                      >
                        {!n.isRead && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-600 rounded-r-full" />
                        )}

                        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', iconStyle)}>
                          <Icon size={14} />
                        </div>

                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotifClick(n)}>
                          <p className={clsx('text-sm font-medium leading-snug', n.isRead ? 'text-gray-500' : 'text-gray-900')}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>

                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                          {!n.isRead && (
                            <button
                              onClick={() => markRead(n._id)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                              aria-label="Mark as read"
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(n._id)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
                            aria-label="Dismiss"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 py-3">
              <a
                href="/notifications"
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium flex items-center justify-center"
              >
                View all notifications
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
