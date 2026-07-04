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

const initialState: AuthState = {
  user: parseStoredUser(),
  accessToken: storedToken,
  isAuthenticated: !!storedToken,
  // If there is a stored token we need to verify it before trusting it
  isInitializing: !!storedToken,
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
