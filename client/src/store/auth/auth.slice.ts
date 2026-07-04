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

// Consider the user authenticated on boot if we have EITHER a stored token
// OR a stored user (the refresh cookie may still be valid even if the access
// token has been cleared). isInitializing will gate all protected routes until
// the server confirms the session.
const hasStoredSession = !!storedToken || !!storedUser;

const initialState: AuthState = {
  user: storedUser,
  accessToken: storedToken,
  isAuthenticated: hasStoredSession,
  // Always initialize — verify the session against the server on every boot
  isInitializing: hasStoredSession,
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
