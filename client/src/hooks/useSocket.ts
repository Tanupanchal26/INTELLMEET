import { useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, onConnectionState, getConnectionState, getSocket, safeEmit, type ConnectionState } from '../utils/socket';
import { useAppSelector } from './useAppDispatch';

export { safeEmit };

export const useSocket = () => {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [connState, setConnState] = useState<ConnectionState>(() => getConnectionState());
  // Keep a stable ref to the socket so callers never get a new object reference
  // on re-render, which would cause downstream useEffect dependency arrays to fire.
  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    socketRef.current = s;
    // Subscribe AFTER connecting so the immediate callback reflects the real state.
    // Use a local flag to skip the synchronous immediate call that onConnectionState
    // makes — we already seeded useState with getConnectionState() above.
    let mounted = true;
    const unsub = onConnectionState((s) => { if (mounted) setConnState(s); });
    return () => {
      mounted = false;
      unsub();
    };
    // Do NOT disconnect on unmount — socket is a singleton shared across the app.
  }, [token]);

  return { socket: socketRef.current, connState };
};
