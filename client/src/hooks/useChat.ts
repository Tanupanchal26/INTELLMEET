import { useEffect, useCallback } from 'react';
import { useSocket, safeEmit } from './useSocket';
import { useChatStore } from '../store/chat/chat.store';
import { useAppSelector } from './useAppDispatch';
import { getSocket } from '../utils/socket';

export const useChat = (meetingId: string) => {
  const { socket } = useSocket(); // socket is a RefObject — stable, never changes identity
  const user = useAppSelector((s) => s.auth.user);
  const messages     = useChatStore((s) => s.messages);
  const typingUsers  = useChatStore((s) => s.typingUsers);

  useEffect(() => {
    if (!socket.current || !meetingId) return;
    const { addMessage, setMessages, setTyping, markRead } = useChatStore.getState();

    const join = () => socket.current!.emit('chat:join', meetingId);
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
      if ((data.sender?._id || data.senderId) !== user?.id) {
        safeEmit('chat:read', { meetingId, msgId, socketId: socket.current!.id });
      }
    };

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

    const onReconnect = () => join();

    socket.current.on('chat:history',  onHistory);
    socket.current.on('chat:message',  onMsg);
    socket.current.on('chat:typing',   onTyping);
    socket.current.on('chat:read',     onRead);
    socket.current.on('connect',       onReconnect);

    return () => {
      socket.current!.off('chat:history',  onHistory);
      socket.current!.off('chat:message',  onMsg);
      socket.current!.off('chat:typing',   onTyping);
      socket.current!.off('chat:read',     onRead);
      socket.current!.off('connect',       onReconnect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]); // socket is a stable ref — safe to omit

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
