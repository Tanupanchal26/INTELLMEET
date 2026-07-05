import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

type QueuedEvent = { event: string; payload: unknown };

let socket: Socket | null = null;
let connState: ConnectionState = 'disconnected';
const offlineQueue: QueuedEvent[] = [];
const stateListeners = new Set<(s: ConnectionState) => void>();

const notifyState = (s: ConnectionState) => {
  connState = s;
  stateListeners.forEach((fn) => fn(s));
};

export const onConnectionState = (fn: (s: ConnectionState) => void) => {
  stateListeners.add(fn);
  fn(connState); // emit current immediately
  return () => stateListeners.delete(fn);
};

export const getConnectionState = () => connState;

export const getSocket = (): Socket => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
    timeout: 10_000,
  });

  socket.on('connect',         () => {
    notifyState('connected');
    // Flush offline queue
    while (offlineQueue.length) {
      const { event, payload } = offlineQueue.shift()!;
      socket!.emit(event, payload);
    }
  });
  socket.on('disconnect',      () => notifyState('disconnected'));
  socket.on('connect_error',   () => notifyState('error'));
  socket.on('reconnecting',    () => notifyState('connecting'));
  socket.on('reconnect',       () => notifyState('connected'));

  return socket;
};

/** Connect with JWT token */
export const connectSocket = (token: string): Socket => {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) {
    notifyState('connecting');
    s.connect();
  }
  return s;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
  notifyState('disconnected');
};

/**
 * Emit immediately if connected, otherwise enqueue for when connection resumes.
 * Use this instead of socket.emit() everywhere to get offline resilience.
 */
export const safeEmit = (event: string, payload: unknown): void => {
  const s = getSocket();
  if (s.connected) {
    s.emit(event, payload);
  } else {
    offlineQueue.push({ event, payload });
  }
};
