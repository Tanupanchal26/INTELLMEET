import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAppSelector } from './useAppDispatch';

export interface OnlineUser {
  userId: string;
  name: string;
  avatar?: string;
  status?: 'online' | 'away' | 'busy';
}

export const usePresence = () => {
  const { socket } = useSocket();
  const user = useAppSelector((s) => s.auth.user);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.emit('presence:list');

    const onList    = (ids: string[]) => {
      setOnlineUsers(prev => ids.map(id => prev.find(u => u.userId === id) || { userId: id, name: '' }));
    };
    const onOnline  = (u: OnlineUser) => setOnlineUsers(prev =>
      prev.find(p => p.userId === u.userId) ? prev : [...prev, { ...u, status: 'online' }]
    );
    const onOffline = ({ userId }: { userId: string }) =>
      setOnlineUsers(prev => prev.filter(u => u.userId !== userId));
    const onStatus  = ({ userId, status }: { userId: string; status: OnlineUser['status'] }) =>
      setOnlineUsers(prev => prev.map(u => u.userId === userId ? { ...u, status } : u));

    socket.on('presence:list',    onList);
    socket.on('presence:online',  onOnline);
    socket.on('presence:offline', onOffline);
    socket.on('presence:status',  onStatus);

    return () => {
      socket.off('presence:list',    onList);
      socket.off('presence:online',  onOnline);
      socket.off('presence:offline', onOffline);
      socket.off('presence:status',  onStatus);
    };
  }, [socket]);

  const setStatus = useCallback((status: 'online' | 'away' | 'busy') => {
    socket?.emit('presence:status', { status });
  }, [socket]);

  const isOnline = useCallback(
    (userId: string) => onlineUsers.some(u => u.userId === userId),
    [onlineUsers]
  );

  return { onlineUsers, setStatus, isOnline, currentUserId: user?.id };
};
