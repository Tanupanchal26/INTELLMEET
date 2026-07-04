import api from './axios';

export interface AgendaItem {
  title: string;
  duration?: number;
  order?: number;
}

export interface MeetingSettings {
  waitingRoom?: boolean;
  muteOnEntry?: boolean;
  recordingEnabled?: boolean;
  chatEnabled?: boolean;
}

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  scheduledAt?: string;
  maxDuration?: number;
  participants?: string[];
  team?: string;
  agenda?: AgendaItem[];
  isRecurring?: boolean;
  recurrence?: { frequency: string; until?: string };
  settings?: MeetingSettings;
}

export const meetingService = {
  create:        (data: CreateMeetingPayload) => api.post('/meetings', data),
  getAll:        (params?: { page?: number; limit?: number; status?: string; search?: string }) =>
    api.get('/meetings', { params }),
  getById:       (id: string) => api.get(`/meetings/${id}`),
  update:        (id: string, data: Partial<CreateMeetingPayload>) => api.put(`/meetings/${id}`, data),
  delete:        (id: string) => api.delete(`/meetings/${id}`),
  invite:        (id: string, userIds: string[]) => api.post(`/meetings/${id}/invite`, { userIds }),
  rsvp:          (id: string, status: 'accepted' | 'declined') => api.post(`/meetings/${id}/rsvp`, { status }),
  start:         (id: string) => api.post(`/meetings/${id}/start`),
  end:           (id: string) => api.post(`/meetings/${id}/end`),
  getNotes:      (id: string) => api.get(`/meetings/${id}/notes`),
  saveNotes:     (id: string, data: object) => api.put(`/meetings/${id}/notes`, data),
  join:          (code: string) => api.post('/meetings/join', { code, meetingId: code }),
};
