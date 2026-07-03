import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket, onConnectionState, getSocket, safeEmit, type ConnectionState } from '../utils/socket';
import { useAppSelector } from './useAppDispatch';

export { safeEmit };

export const useSocket = () => {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [connState, setConnState] = useState<ConnectionState>('disconnected');

  useEffect(() => {
    if (!token) return;
    connectSocket(token);
    const unsub = onConnectionState(setConnState);
    return () => { unsub(); };
    // Do NOT disconnect on unmount — socket is a singleton shared across the app.
  }, [token]);

  return { socket: getSocket(), connState };
};
