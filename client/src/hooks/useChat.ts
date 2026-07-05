import { useEffect, useCallback } from 'react';
import { useSocket, safeEmit } from './useSocket';
import { useChatStore } from '../store/chat/chat.store';
import { useAppSelector } from './useAppDispatch';
import { getSocket } from '../utils/socket';

export const useChat = (meetingId: string) => {
  const { socket } = useSocket();
  const user = useAppSelector((s) => s.auth.user);
  const messages     = useChatStore((s) => s.messages);
  const typingUsers  = useChatStore((s) => s.typingUsers);

  useEffect(() => {
    if (!socket || !meetingId) return;
    // Read actions from getState() inside the effect so they are never stale
    // and never appear in the dependency array.
    const { addMessage, setMessages, setTyping, markRead } = useChatStore.getState();

    const join = () => socket.emit('chat:join', meetingId);
    join();

    const onMsg = (data: any) => {
      const msgId = data._id || data.id;
      addMessage({
        id: msgId,
        senderId: data.sender?._id || data.senderId,
        senderName: data.sender?.name || data.senderName,
        senderAvatar: data.sender?.avatar || data.senderAvatar,
        content: data.content,
        timestamp: data.createdAt || data.timestamp,
        type: data.type || 'text',
        readBy: data.readBy ?? [],
      });
      // Emit read receipt immediately for messages from others
      if ((data.sender?._id || data.senderId) !== user?.id) {
        safeEmit('chat:read', { meetingId, msgId, socketId: socket.id });
      }
    };

    // Load full history when joining (sent by server on chat:join)
    const onHistory = (history: any[]) => {
      const mapped = (history ?? []).map((data: any) => ({
        id: data._id || data.id,
        senderId: data.sender?._id || data.senderId,
        senderName: data.sender?.name || data.senderName,
        senderAvatar: data.sender?.avatar || data.senderAvatar,
        content: data.content,
        timestamp: data.createdAt || data.timestamp,
        type: data.type || 'text',
        readBy: data.readBy ?? [],
      }));
      setMessages(mapped);
    };

    const onTyping = ({ name, isTyping }: { name: string; isTyping: boolean }) =>
      setTyping(name, isTyping);

    const onRead = ({ msgId, socketId }: { msgId: string; socketId: string }) =>
      markRead(msgId, socketId);

    // Re-join room after reconnect so we don't miss messages
    const onReconnect = () => join();

    socket.on('chat:history',  onHistory);
    socket.on('chat:message',  onMsg);
    socket.on('chat:typing',   onTyping);
    socket.on('chat:read',     onRead);
    socket.on('connect',       onReconnect);

    return () => {
      socket.off('chat:history',  onHistory);
      socket.off('chat:message',  onMsg);
      socket.off('chat:typing',   onTyping);
      socket.off('chat:read',     onRead);
      socket.off('connect',       onReconnect);
      // Do NOT call clearChat() here — ChatBox unmounts when switching panels
      // and we must preserve messages. clearChat() is called only on meeting end (resetMeeting).
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, socket]);

  const sendMessage = useCallback((content: string) => {
    safeEmit('chat:message', { meetingId, content });
  }, [meetingId]);

  const sendTyping = useCallback((name: string, isTyping: boolean) =>
    safeEmit('chat:typing', { meetingId, name, isTyping }),
  [meetingId]);

  /** Mark a specific message as read by the local user */
  const sendRead = useCallback((msgId: string) => {
    const s = getSocket();
    if (s?.connected) {
      s.emit('chat:read', { meetingId, msgId, socketId: s.id });
    }
  }, [meetingId]);

  return { messages, typingUsers, sendMessage, sendTyping, sendRead };
};
