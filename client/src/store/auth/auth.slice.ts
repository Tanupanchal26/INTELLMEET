import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '../../constants';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  isVerified?: boolean;
  tenantId?: string;
  status?: string;
  lastLogin?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true while the app is verifying a stored token on boot */
  isInitializing: boolean;
}

const parseStoredUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) ?? 'null');
  } catch {
    return null;
  }
};

const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
const storedUser  = parseStoredUser();

const initialState: AuthState = {
  user: storedUser,
  accessToken: storedToken,
  // Optimistically mark authenticated if we have cached data — AuthSync will
  // confirm or clear this against the server before any route renders.
  isAuthenticated: !!storedToken || !!storedUser,
  // ALWAYS initialize on every boot so AuthSync runs unconditionally.
  // This is the key fix: even when localStorage is empty the refresh cookie
  // may still be valid, so we must always attempt session restoration.
  isInitializing: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      { payload }: PayloadAction<{ user: User; accessToken: string }>
    ) {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      state.isAuthenticated = true;
      state.isInitializing = false;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, payload.accessToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(payload.user));
    },
    refreshAccessToken(state, { payload }: PayloadAction<string>) {
      state.accessToken = payload;
      state.isAuthenticated = true;
      state.isInitializing = false;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, payload);
    },
    clearAuth(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    },
    setInitialized(state) {
      state.isInitializing = false;
    },
  },
});

export const { setCredentials, refreshAccessToken, clearAuth, setInitialized } = authSlice.actions;
export default authSlice.reducer;
