import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, Lock, Plus, Send, Users, ChevronLeft, Trash2, Circle, MessageSquare, LayoutDashboard } from 'lucide-react';
import { teamService, type Team, type Channel } from '../api/team.api';
import { channelService } from '../api/channel.api';
import { useAppSelector } from '../hooks/useAppDispatch';
import { useSocket, safeEmit } from '../hooks/useSocket';
import { useChatStore, type ChannelMessage } from '../store/chat/chat.store';
import { usePresence } from '../hooks/usePresence';
import { toChannel, toWorkspace } from '../constants';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Loader from '../components/common/Loader';
import { ChannelHeader } from '../components/channels/ChannelHeader';
import { TeamMembersModal } from '../components/team/TeamMembersModal';
import { TeamChatView } from '../components/team/TeamChatView';

import { MessageList } from '../features/chat/components/MessageList';
import { MessageInput } from '../features/chat/components/MessageInput';
import { TypingIndicator } from '../components/common/TypingIndicator';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];



/* ─── ChannelView ──────────────────────────────────────────────────────────── */
const ChannelView = ({ channel }: { channel: Channel }) => {
  const qc      = useQueryClient();
  const user    = useAppSelector((s) => s.auth.user);
  const { socket } = useSocket();
  const store   = useChatStore();
  const { isOnline } = usePresence();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [content,     setContent]     = useState('');
  const [showEmoji,   setShowEmoji]   = useState<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const messages    = store.channelMessages[channel._id] ?? [];
  const typingNames = store.channelTyping[channel._id]   ?? [];

  /* ── Initial load ── */
  const { isLoading } = useQuery({
    queryKey: ['messages', channel._id],
    queryFn: () => channelService.getMessages(channel._id).then((r: any) => {
      const msgs: ChannelMessage[] = r.data?.data ?? r.data ?? [];
      store.initChannel(channel._id, msgs);
      return msgs;
    }),
    staleTime: Infinity, // socket keeps it fresh — no re-fetch
  });

  /* ── Socket room join/leave + event wiring ── */
  useEffect(() => {
    if (!socket.current || !channel._id) return;

    socket.current.emit('channel:join', channel._id);
    store.clearUnread(channel._id);

    const last = messages[messages.length - 1];
    if (last && user?.id) {
      safeEmit('channel:read', { channelId: channel._id, messageId: last._id });
      store.markChannelRead(channel._id, user.id, last._id);
    }

    const onMessage = (msg: ChannelMessage) => {
      store.appendChannelMsg(channel._id, msg);
      safeEmit('channel:delivered', { channelId: channel._id, messageId: msg._id });
    };
    const onTyping   = ({ userId, name, isTyping }: { userId: string; name: string; isTyping: boolean }) =>
      store.setChannelTyping(channel._id, userId, name, isTyping);
    const onReaction = ({ messageId, reactions }: any) =>
      store.updateMsgReactions(channel._id, messageId, reactions);
    const onDeleted  = ({ messageId }: { messageId: string }) =>
      store.setMessageDeleted(channel._id, messageId);
    const onEdited   = (msg: ChannelMessage) =>
      store.setMessageEdited(channel._id, msg);
    const onDelivery = ({ messageId, state }: { messageId: string; state: any }) =>
      store.updateMsgDelivery(channel._id, messageId, state);
    const onRead     = ({ userId, messageId }: { userId: string; messageId: string }) =>
      store.markChannelRead(channel._id, userId, messageId);

    socket.current.on('channel:message',   onMessage);
    socket.current.on('channel:typing',    onTyping);
    socket.current.on('chat:reaction',     onReaction);
    socket.current.on('chat:deleted',      onDeleted);
    socket.current.on('chat:edited',       onEdited);
    socket.current.on('channel:delivery',  onDelivery);
    socket.current.on('channel:read',      onRead);

    return () => {
      socket.current!.off('channel:message',  onMessage);
      socket.current!.off('channel:typing',   onTyping);
      socket.current!.off('chat:reaction',    onReaction);
      socket.current!.off('chat:deleted',     onDeleted);
      socket.current!.off('chat:edited',      onEdited);
      socket.current!.off('channel:delivery', onDelivery);
      socket.current!.off('channel:read',     onRead);
      socket.current!.emit('channel:leave',   channel._id);
    };
  }, [channel._id]); // socket is a stable ref — safe to omit

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    const last = messages[messages.length - 1];
    if (last && user?.id) {
      safeEmit('channel:read', { channelId: channel._id, messageId: last._id });
      store.markChannelRead(channel._id, user.id, last._id);
    }
  }, [messages.length]);

  /* ── Typing ── */
  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      safeEmit('channel:typing', { channelId: channel._id, isTyping: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      safeEmit('channel:typing', { channelId: channel._id, isTyping: false });
    }, 2000);
  }, [channel._id]);

  /* ── Send ── */
  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text || !user) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      safeEmit('channel:typing', { channelId: channel._id, isTyping: false });
      if (typingTimer.current) clearTimeout(typingTimer.current);
    }

    const tempId = `temp_${Date.now()}`;
    const optimistic: ChannelMessage = {
      _id: tempId,
      content: text,
      sender: { _id: user.id, name: user.name },
      type: 'text',
      reactions: [],
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      delivery: 'sending',
    };
    store.appendChannelMsg(channel._id, optimistic);
    setContent('');

    safeEmit('channel:message', { channelId: channel._id, content: text });
  }, [content, user, channel._id]);

  /* ── React ── */
  const handleReact = useCallback((msgId: string, emoji: string) => {
    safeEmit('chat:react', { channelId: channel._id, messageId: msgId, emoji });
    setShowEmoji(null);
  }, [channel._id]);

  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: (msgId: string) => channelService.deleteMessage(channel._id, msgId),
    onMutate: (msgId) => store.setMessageDeleted(channel._id, msgId),
    onError: () => toast.error('Delete failed'),
  });

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[var(--color-bg)]/10">
      <ChannelHeader channel={channel} isAdmin={isAdmin} onBack={() => navigate('/teams')} />

      {/* Messages */}
      <MessageList
          messages={messages}
          userId={user?.id}
          isOnline={isOnline}
          onReact={handleReact}
          onDelete={msgId => deleteMutation.mutate(msgId)}
      />

      {/* Typing indicator */}
      <TypingIndicator names={typingNames} />

      {/* Input */}
      <MessageInput
        content={content}
        setContent={setContent}
        handleSend={handleSend}
        handleTyping={handleTyping}
        showEmoji={showEmoji}
        setShowEmoji={setShowEmoji}
        emojis={EMOJIS}
      />
    </div>
  );
};

/* ─── Channels (page) ───────────────────────────────────────────────────────── */
const Channels = () => {
  const { id: teamId, channelId } = useParams<{ id: string; channelId: string }>();
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { unreadCounts } = useChatStore();
  const isAdmin = useAppSelector((s) => {
    const role = s.auth.user?.role;
    return role === 'admin' || role === 'super_admin';
  });
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'public' as 'public' | 'private' | 'announcement' });

  // Local state for when loaded via `/channels` (no URL parameters)
  const [localTeamId, setLocalTeamId] = useState<string | null>(null);
  const [localChannelId, setLocalChannelId] = useState<string | null>(null);

  // Fetch all teams to populate workspace dropdown on /channels
  const { data: allTeams = [], isLoading: allTeamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => teamService.list().then((r: any) => r.data),
  });

  // Resolve active team: URL parameter takes priority, otherwise local selection or first team
  const activeTeamId = teamId ?? localTeamId ?? (allTeams.length > 0 ? allTeams[0]._id : null);

  // Set default team locally if on /channels
  useEffect(() => {
    if (!teamId && allTeams.length > 0 && !localTeamId) {
      setLocalTeamId(allTeams[0]._id);
    }
  }, [allTeams, teamId, localTeamId]);

  // Fetch active team details
  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ['team', activeTeamId],
    queryFn: () => teamService.getById(activeTeamId!).then((r: any) => r.data),
    enabled: !!activeTeamId,
  });

  // Fetch channels of active team
  const { data: channels = [], isLoading: chLoading } = useQuery<Channel[]>({
    queryKey: ['channels', activeTeamId],
    queryFn: () => teamService.listChannels(activeTeamId!).then((r: any) => r.data),
    enabled: !!activeTeamId,
  });

  // Resolve active channel
  const activeChannel = channels.find((c) => c._id === (channelId ?? localChannelId)) ?? channels[0] ?? null;

  // Auto-redirect to first channel if on team-specific route
  useEffect(() => {
    if (teamId && !channelId && channels.length > 0) {
      navigate(toChannel(teamId, channels[0]._id), { replace: true });
    }
  }, [channels, channelId, teamId, navigate]);

  // Set default active channel locally if on /channels route
  useEffect(() => {
    if (!teamId && channels.length > 0 && !localChannelId) {
      setLocalChannelId(channels[0]._id);
    }
  }, [channels, teamId, localChannelId]);

  const createChannelMutation = useMutation({
    mutationFn: (data: typeof form) => teamService.createChannel(activeTeamId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels', activeTeamId] });
      toast.success('Channel created!');
      setShowCreate(false);
      setForm({ name: '', description: '', type: 'public' });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create channel'),
  });

  const handleChannelClick = (ch: Channel) => {
    setShowTeamChat(false);
    if (teamId) {
      navigate(toChannel(teamId, ch._id));
    } else {
      setLocalChannelId(ch._id);
    }
  };

  const isLoading = (teamId ? teamLoading : (allTeamsLoading || teamLoading)) || chLoading;
  if (isLoading) return <Loader fullPage />;

  return (
    <div className="flex h-full animate-fade-in border border-[var(--color-border)] rounded-2xl overflow-hidden bg-[var(--color-surface)] shadow-md">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)]/50 border-r border-[var(--color-border)]">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
          {teamId && (
            <button onClick={() => navigate('/teams')} className="p-1 rounded-lg hover:bg-black/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
              <ChevronLeft size={15} />
            </button>
          )}
          <p className="font-bold text-sm text-[var(--color-text)] truncate flex-1">
            {teamId ? team?.name : (allTeams.find((t) => t._id === activeTeamId)?.name ?? 'Channels')}
          </p>
          <Users size={13} className="text-[var(--color-text-dim)]" />
        </div>

        {/* Workspace Dropdown for /channels route */}
        {!teamId && allTeams.length > 0 && (
          <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/20">
            <label className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">Select Workspace</label>
            <select
              value={activeTeamId ?? ''}
              onChange={(e) => {
                setLocalTeamId(e.target.value);
                setLocalChannelId(null);
              }}
              className="w-full text-xs font-semibold bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-3 py-2 outline-none focus:border-[var(--color-primary)] text-[var(--color-text)] cursor-pointer shadow-sm hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {allTeams.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {/* Team Chat entry */}
          <button
            onClick={() => setShowTeamChat(true)}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] transition-all text-left border cursor-pointer mb-1',
              showTeamChat
                ? 'bg-indigo-50 text-indigo-750 border-indigo-150 font-bold shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text)] border-transparent'
            )}
          >
            <MessageSquare size={13} />
            <span className="truncate flex-1">Team Chat</span>
          </button>

          {/* Workspace tab */}
          <button
            onClick={() => {
              setShowTeamChat(false);
              if (teamId) {
                navigate(toWorkspace(teamId));
              } else if (activeTeamId) {
                navigate(toWorkspace(activeTeamId));
              }
            }}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] transition-all text-left border cursor-pointer mb-2',
              'text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text)] border-transparent'
            )}
          >
            <LayoutDashboard size={13} />
            <span className="truncate flex-1">Workspace</span>
          </button>

          <div className="flex items-center justify-between px-2.5 py-1.5 mb-1">
            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Channels</span>
            {isAdmin && (
              <button onClick={() => setShowCreate(true)} className="p-1 rounded-lg hover:bg-black/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors cursor-pointer">
                <Plus size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-0.5">
            {channels.map((ch) => {
              const unread = unreadCounts[ch._id] ?? 0;
              const isActive = ch._id === activeChannel?._id;
              return (
                <button key={ch._id} onClick={() => handleChannelClick(ch)}
                  className={clsx(
                    'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] transition-all text-left border cursor-pointer',
                    isActive
                      ? 'bg-indigo-50 text-indigo-750 border-indigo-150 font-bold shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-text)] border-transparent'
                  )}>
                  {ch.type === 'private' ? <Lock size={13} /> : <Hash size={13} />}
                  <span className="truncate flex-1">{ch.name}</span>
                  {unread > 0 && (
                    <span className="ml-auto text-[9px] bg-indigo-600 text-white rounded-full px-1.5 py-0.5 font-bold shadow-sm">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {ch.isDefault && !unread && (
                    <span className="ml-auto text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-full">default</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30">
          <button 
            onClick={() => team && setShowMembers(true)} 
            className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 font-semibold hover:text-[var(--color-primary)] transition-colors cursor-pointer"
          >
            <Users size={13} className="text-indigo-600" />
            {team?.members?.length ?? 0} members
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg)]/5">
        {showTeamChat && activeTeamId ? (
          <TeamChatView teamId={activeTeamId} teamName={team?.name ?? 'Team'} />
        ) : activeChannel ? (
          <ChannelView channel={activeChannel} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center opacity-70">
            <Hash size={36} className="text-[var(--color-text-dim)]" />
            <p className="text-[var(--color-text-muted)] text-sm font-semibold">Select a channel</p>
            {isAdmin && (
              <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={14} /> Create Channel</Button>
            )}
          </div>
        )}
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Channel">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block uppercase tracking-wider">Channel Name *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. general" className="input-light" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block uppercase tracking-wider">Description</label>
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What is this channel for?" className="input-light" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block uppercase tracking-wider">Type</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))} className="input-light bg-white border-[var(--color-border)] w-full">
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => createChannelMutation.mutate(form)}
              disabled={!form.name.trim() || createChannelMutation.isPending}>
              {createChannelMutation.isPending ? 'Creating...' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </Modal>

      {team && (
        <TeamMembersModal 
          open={showMembers} 
          onClose={() => setShowMembers(false)} 
          team={team} 
        />
      )}
    </div>
  );
};

export default Channels;
