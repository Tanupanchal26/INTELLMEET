import api from './axios';

export interface TeamMember {
  user: { _id: string; name: string; email: string; avatar?: string };
  role: 'owner' | 'admin' | 'member' | 'guest';
  status: 'pending' | 'active';
  joinedAt: string;
}

export interface Team {
  _id: string;
  name: string;
  slug: string;
  description: string;
  avatar?: string;
  isPrivate: boolean;
  members: TeamMember[];
  createdAt: string;
}

export interface Channel {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  topic?: string;
  type: 'public' | 'private' | 'announcement' | 'dm';
  isDefault: boolean;
  lastMessageAt?: string;
}

export const teamService = {
  create:             (data: Partial<Team>) => api.post<Team>('/teams', data),
  list:               () => api.get<Team[]>('/teams'),
  getById:            (id: string) => api.get<Team>(`/teams/${id}`),
  update:             (id: string, data: Partial<Team>) => api.put<Team>(`/teams/${id}`, data),
  delete:             (id: string) => api.delete(`/teams/${id}`),
  inviteMember:       (id: string, userId: string, role = 'member') => api.post(`/teams/${id}/members`, { userId, role }),
  inviteByEmail:      (id: string, email: string, role = 'member') => api.post(`/teams/${id}/invite`, { email, role }),
  acceptInvite:       (id: string) => api.post(`/teams/${id}/join`),
  removeMember:       (id: string, userId: string) => api.delete(`/teams/${id}/members/${userId}`),
  updateMemberRole:   (id: string, userId: string, role: string) => api.patch(`/teams/${id}/members/${userId}/role`, { role }),
  listChannels:       (teamId: string) => api.get<Channel[]>(`/teams/${teamId}/channels`),
  createChannel:      (teamId: string, data: Partial<Channel>) => api.post<Channel>(`/teams/${teamId}/channels`, data),
  searchUsersToInvite:(query: string) => api.get<{ _id: string; name: string; email: string; avatar?: string }[]>(`/teams/search/users?q=${encodeURIComponent(query)}`),
};

export interface TeamMessage {
  _id: string;
  team: string;
  sender: { _id: string; name: string; email?: string; avatar?: string };
  content: string;
  type: 'text' | 'file' | 'system' | 'announcement';
  attachments: { url: string; name: string; mimeType?: string; size?: number }[];
  reactions: { emoji: string; users: string[] }[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  delivery?: 'sending' | 'sent' | 'delivered';
}

export const teamChatService = {
  getMessages: (teamId: string, cursor?: string) =>
    api.get<TeamMessage[]>(`/teams/${teamId}/chat`, { params: { limit: 50, cursor } }),
  sendMessage: (teamId: string, data: { content: string; type?: string }) =>
    api.post<TeamMessage>(`/teams/${teamId}/chat`, data),
  editMessage: (teamId: string, messageId: string, content: string) =>
    api.put<TeamMessage>(`/teams/${teamId}/chat/${messageId}`, { content }),
  deleteMessage: (teamId: string, messageId: string) =>
    api.delete(`/teams/${teamId}/chat/${messageId}`),
  toggleReaction: (teamId: string, messageId: string, emoji: string) =>
    api.post(`/teams/${teamId}/chat/${messageId}/react`, { emoji }),
};

