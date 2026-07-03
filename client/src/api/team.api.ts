import api from './axios';

export interface TeamMember {
  user: { _id: string; name: string; email: string; avatar?: string };
  role: 'owner' | 'admin' | 'member' | 'guest';
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
  removeMember:       (id: string, userId: string) => api.delete(`/teams/${id}/members/${userId}`),
  updateMemberRole:   (id: string, userId: string, role: string) => api.patch(`/teams/${id}/members/${userId}/role`, { role }),
  listChannels:       (teamId: string) => api.get<Channel[]>(`/teams/${teamId}/channels`),
  createChannel:      (teamId: string, data: Partial<Channel>) => api.post<Channel>(`/teams/${teamId}/channels`, data),
  searchUsersToInvite:(query: string) => api.get<{ _id: string; name: string; email: string; avatar?: string }[]>(`/teams/search/users?q=${encodeURIComponent(query)}`),
};
