import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { notificationService, type Notification } from '../../api/notification.api';

interface NotifState {
  items: Notification[];
  unread: number;
  loading: boolean;
  page: number;
  hasMore: boolean;
}

const initialState: NotifState = {
  items: [],
  unread: 0,
  loading: false,
  page: 1,
  hasMore: true,
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  (params: { page?: number; unreadOnly?: boolean } = {}) =>
    notificationService.list(params).then((r: any) => r as { data: Notification[]; unread: number; total: number })
);

export const markRead = createAsyncThunk('notifications/markRead', (id: string) =>
  notificationService.markRead(id).then(() => id)
);

export const markAllRead = createAsyncThunk('notifications/markAllRead', () =>
  notificationService.markAllRead()
);

const notifSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    pushNotification: (state, action: PayloadAction<Notification>) => {
      state.items.unshift(action.payload);
      state.unread += 1;
    },
    setUnread: (state, action: PayloadAction<number>) => {
      state.unread = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending,   (s) => { s.loading = true; })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        s.loading = false;
        s.items = a.payload.data;
        s.unread = a.payload.unread;
        s.hasMore = a.payload.data.length === 20;
      })
      .addCase(markRead.fulfilled, (s, a) => {
        const n = s.items.find(i => i._id === a.payload);
        if (n && !n.isRead) { n.isRead = true; s.unread = Math.max(0, s.unread - 1); }
      })
      .addCase(markAllRead.fulfilled, (s) => {
        s.items.forEach(n => { n.isRead = true; });
        s.unread = 0;
      });
  },
});

export const { pushNotification, setUnread } = notifSlice.actions;
export default notifSlice.reducer;
