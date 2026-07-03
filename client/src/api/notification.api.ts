import api from './axios';

export interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: string;
  refModel?: string;
  refId?: string;
  actor?: { _id: string; name: string; avatar?: string };
  createdAt: string;
}

export const notificationService = {
  list:       (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get<{ data: Notification[]; unread: number }>('/notifications', { params }),
  markRead:   (id: string) => api.patch(`/notifications/${id}/read`, {}),
  markAllRead:() => api.post('/notifications/read-all', {}),
  delete:     (id: string) => api.delete(`/notifications/${id}`),
};
