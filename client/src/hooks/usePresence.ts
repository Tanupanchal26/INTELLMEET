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
    if (!socket.current) return;

    socket.current.emit('presence:list');

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

    socket.current.on('presence:list',    onList);
    socket.current.on('presence:online',  onOnline);
    socket.current.on('presence:offline', onOffline);
    socket.current.on('presence:status',  onStatus);

    return () => {
      socket.current!.off('presence:list',    onList);
      socket.current!.off('presence:online',  onOnline);
      socket.current!.off('presence:offline', onOffline);
      socket.current!.off('presence:status',  onStatus);
    };
  }, []); // socket is a stable ref — safe to omit

  const setStatus = useCallback((status: 'online' | 'away' | 'busy') => {
    socket.current?.emit('presence:status', { status });
  }, []);

  const isOnline = useCallback(
    (userId: string) => onlineUsers.some(u => u.userId === userId),
    [onlineUsers]
  );

  return { onlineUsers, setStatus, isOnline, currentUserId: user?.id };
};
