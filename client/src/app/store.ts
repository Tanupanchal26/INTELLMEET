import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/auth/auth.slice';
import uiReducer from '../store/ui/ui.slice';
import notificationReducer from '../store/notifications/notification.slice';
import teamReducer from '../store/team/team.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    notifications: notificationReducer,
    teams: teamReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
