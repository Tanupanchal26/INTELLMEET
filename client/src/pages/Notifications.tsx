import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Video, Users, AtSign, CheckSquare, Info, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationService, type Notification } from '../api/notification.api';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { SkeletonCard } from '../components/common/Loader';
import { teamService } from '../api/team.api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const ICONS: Record<string, React.ElementType> = {
  meeting_invite: Video, meeting_started: Video, meeting_ended: Video, meeting_reminder: Video,
  team_invite: Users, team_role_changed: Users,
  channel_mention: AtSign, message_reply: AtSign,
  task_assigned: CheckSquare, task_due: CheckSquare,
  ai_summary_ready: Sparkles, action_item_assigned: CheckSquare,
  system: Info,
};

const ICON_STYLE: Record<string, string> = {
  meeting_invite:       'bg-indigo-50 text-indigo-700 border border-indigo-150',
  meeting_started:      'bg-emerald-50 text-emerald-700 border border-emerald-150',
  meeting_ended:        'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
  meeting_reminder:     'bg-amber-50 text-amber-700 border border-amber-150',
  team_invite:          'bg-blue-50 text-blue-700 border border-blue-150',
  team_role_changed:    'bg-orange-50 text-orange-700 border border-orange-150',
  channel_mention:      'bg-violet-50 text-violet-700 border border-violet-150',
  message_reply:        'bg-violet-50 text-violet-700 border border-violet-150',
  task_assigned:        'bg-blue-50 text-blue-700 border border-blue-150',
  task_due:             'bg-red-50 text-red-700 border border-red-150',
  ai_summary_ready:     'bg-indigo-50 text-indigo-700 border border-indigo-150',
  action_item_assigned: 'bg-teal-50 text-teal-700 border border-teal-150',
  system:               'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
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

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

type Filter = 'all' | 'unread' | 'meetings' | 'tasks' | 'mentions';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'unread',   label: 'Unread' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'tasks',    label: 'Tasks' },
  { id: 'mentions', label: 'Mentions' },
];

const Notifications = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const filterNotif = (n: Notification) => {
    if (filter === 'unread')   return !n.isRead;
    if (filter === 'meetings') return n.type.startsWith('meeting');
    if (filter === 'tasks')    return n.type.startsWith('task') || n.type === 'action_item_assigned';
    if (filter === 'mentions') return n.type.includes('mention') || n.type.includes('reply');
    return true;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list({ limit: 50 }).then((r: any) => r.data as { data: Notification[]; unread: number }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    // No refetchInterval — real-time updates arrive via socket (notification:new)
  });

  const notifications = (data?.data ?? []).filter(n => filterNotif(n));
  const unreadCount   = data?.unread ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const acceptInvite = useMutation({
    mutationFn: (notif: Notification) => {
      if (!notif.link?.includes('/teams/')) return Promise.reject('Invalid link');
      const teamId = notif.link.split('/teams/')[1];
      return teamService.acceptInvite(teamId).then(() => notificationService.markRead(notif._id));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Joined team successfully!');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to join team'),
  });

  const rejectInvite = useMutation({
    mutationFn: async (notif: Notification) => {
      if (notif.link?.includes('/teams/')) {
        const teamId = notif.link.split('/teams/')[1];
        await teamService.rejectInvite(teamId);
      }
      return notificationService.delete(notif._id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Invitation declined');
    },
    onError: () => toast.error('Failed to decline invitation'),
  });

  const handleClick = async (notif: Notification) => {
    if (!notif.isRead) markRead.mutate(notif._id);
    const link = getDeepLink(notif);
    if (link) navigate(link);
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl w-full font-sans text-[var(--color-text)]">

      {/* Header */}
      <motion.div
        className="flex items-center justify-between flex-wrap gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="primary">{unreadCount} unread</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CheckCheck size={13} />}
            onClick={() => markAll.mutate()}
            loading={markAll.isPending}
          >
            Mark all read
          </Button>
        )}
      </motion.div>

      {/* Filter tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] self-start"
        role="tablist"
        aria-label="Notification filters"
      >
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer',
              filter === id
                ? 'bg-white text-indigo-700 border border-[var(--color-border)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-3" aria-label="Loading notifications">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && notifications.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center py-20 gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <Bell size={24} className="text-indigo-600" />
          </div>
          <div className="text-center px-4">
            <p className="text-sm font-bold text-[var(--color-text)]">
              {filter === 'all' ? 'All caught up' : `No ${filter} notifications`}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] font-semibold mt-1">
              {filter === 'all' ? "You're up to date. Check back later." : `No notifications match this filter.`}
            </p>
          </div>
          {filter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>View all</Button>
          )}
        </motion.div>
      )}

      {/* Notifications list */}
      {!isLoading && notifications.length > 0 && (
        <div
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] backdrop-blur-md overflow-hidden divide-y divide-[var(--color-border)]/50 shadow-md"
          role="list"
          aria-label="Notifications"
        >
          <AnimatePresence>
            {notifications.map((notif, i) => {
              const Icon      = ICONS[notif.type] ?? Info;
              const iconStyle = ICON_STYLE[notif.type] ?? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]';
              return (
                <motion.div
                  key={notif._id}
                  role="listitem"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6, height: 0 }}
                  transition={{ duration: 0.22, delay: i * 0.025 }}
                  onClick={() => handleClick(notif)}
                  className={clsx(
                    'flex items-start gap-4 p-4 group transition-colors relative cursor-pointer',
                    notif.isRead
                      ? 'hover:bg-black/5'
                      : 'bg-indigo-50/25 hover:bg-indigo-50/50'
                  )}
                >
                  {/* Unread indicator */}
                  {!notif.isRead && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-600 rounded-r-full"
                      aria-hidden="true"
                    />
                  )}

                  <div
                    className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm', iconStyle)}
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={clsx(
                          'text-sm tracking-tight leading-snug',
                          notif.isRead ? 'text-[var(--color-text-secondary)] font-semibold' : 'text-[var(--color-text)] font-extrabold'
                        )}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 leading-relaxed font-semibold">
                            {notif.body}
                          </p>
                        )}
                      </div>
                      {!notif.isRead && (
                        <div className="w-2 h-2 rounded-full bg-indigo-650 flex-shrink-0 mt-1.5 shadow-sm" aria-label="Unread" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--color-text-dim)] font-semibold">
                      <span>{timeAgo(notif.createdAt)}</span>
                      {notif.actor && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--color-text-secondary)]">by {notif.actor.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                    {notif.type === 'team_invite' && !notif.isRead && notif.link?.includes('/teams/') && (
                      <>
                        <button
                          onClick={() => acceptInvite.mutate(notif)}
                          disabled={acceptInvite.isPending || rejectInvite.isPending}
                          className="p-1.5 px-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer"
                          aria-label="Accept team invite"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectInvite.mutate(notif)}
                          disabled={acceptInvite.isPending || rejectInvite.isPending}
                          className="p-1.5 px-3 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all cursor-pointer mr-1"
                          aria-label="Reject team invite"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {!notif.isRead && (
                      <button
                        onClick={() => markRead.mutate(notif._id)}
                        className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
                        aria-label="Mark as read"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => del.mutate(notif._id)}
                      className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-650 hover:bg-red-50 transition-all cursor-pointer"
                      aria-label="Delete notification"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Notifications;
