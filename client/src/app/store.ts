import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/auth/auth.slice';
import uiReducer from '../store/ui/ui.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
