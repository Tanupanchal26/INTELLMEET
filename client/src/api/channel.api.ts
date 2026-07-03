import api from './axios';

export interface Message {
  _id: string;
  content: string;
  sender: { _id: string; name: string; avatar?: string };
  type: 'text' | 'file' | 'system' | 'announcement';
  attachments: { url: string; name: string; mimeType: string; size: number }[];
  reactions: { emoji: string; users: string[] }[];
  mentions: { _id: string; name: string }[];
  isEdited: boolean;
  isDeleted: boolean;
  parentId?: string;
  threadCount: number;
  createdAt: string;
}

export const channelService = {
  get:          (id: string) => api.get(`/channels/${id}`),
  update:       (id: string, data: object) => api.put(`/channels/${id}`, data),
  archive:      (id: string) => api.delete(`/channels/${id}`),
  getMessages:  (id: string, params?: { page?: number; limit?: number; before?: string }) =>
    api.get<{ data: Message[] }>(`/channels/${id}/messages`, { params }),
  sendMessage:  (id: string, data: { content: string; mentions?: string[]; attachments?: object[] }) =>
    api.post<Message>(`/channels/${id}/messages`, data),
  editMessage:  (channelId: string, msgId: string, content: string) =>
    api.put(`/channels/${channelId}/messages/${msgId}`, { content }),
  deleteMessage:(channelId: string, msgId: string) =>
    api.delete(`/channels/${channelId}/messages/${msgId}`),
  toggleReaction:(channelId: string, msgId: string, emoji: string) =>
    api.post(`/channels/${channelId}/messages/${msgId}/react`, { emoji }),
  pinMessage:   (channelId: string, msgId: string) =>
    api.post(`/channels/${channelId}/messages/${msgId}/pin`, {}),
  unpinMessage: (channelId: string, msgId: string) =>
    api.delete(`/channels/${channelId}/messages/${msgId}/pin`),
};
