import { useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, onConnectionState, getSocket, safeEmit, type ConnectionState } from '../utils/socket';
import { useAppSelector } from './useAppDispatch';

export { safeEmit };

export const useSocket = () => {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  // Keep a stable ref to the socket so callers never get a new object reference
  // on re-render, which would cause downstream useEffect dependency arrays to fire.
  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    socketRef.current = s;
    const unsub = onConnectionState(setConnState);
    return () => { unsub(); };
    // Do NOT disconnect on unmount — socket is a singleton shared across the app.
  }, [token]);

  return { socket: socketRef.current, connState };
};
