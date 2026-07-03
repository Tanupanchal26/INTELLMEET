import { useEffect } from 'react';
import { useSocket, safeEmit } from './useSocket';
import { useChatStore } from '../store/chat/chat.store';
import type { ChatMessage } from '../store/chat/chat.store';

export const useChat = (meetingId: string) => {
  const { socket } = useSocket();
  const { messages, typingUsers, addMessage, setTyping } = useChatStore();

  useEffect(() => {
    if (!socket || !meetingId) return;
    socket.emit('chat:join', meetingId);

    const onMsg = (data: any) => {
      addMessage({
        id: data._id || data.id,
        senderId: data.sender?._id || data.senderId,
        senderName: data.sender?.name || data.senderName,
        senderAvatar: data.sender?.avatar || data.senderAvatar,
        content: data.content,
        timestamp: data.createdAt || data.timestamp,
        type: data.type || 'text',
      });
    };
    const onTyping = ({ name, isTyping }: { name: string; isTyping: boolean }) =>
      setTyping(name, isTyping);

    socket.on('chat:message', onMsg);
    socket.on('chat:typing',  onTyping);

    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:typing',  onTyping);
      socket.emit('chat:leave', meetingId);
    };
  }, [meetingId, socket]);

  const sendMessage = (content: string) => {
    safeEmit('chat:message', { meetingId, content });
  };

  const sendTyping = (name: string, isTyping: boolean) =>
    safeEmit('chat:typing', { meetingId, name, isTyping });

  return { messages, typingUsers, sendMessage, sendTyping };
};
