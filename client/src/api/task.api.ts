import api from './axios';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority?: 'high' | 'medium' | 'low' | 'urgent';
  assignedTo?: { _id: string; name: string; email: string; avatar?: string };
  createdBy?: { _id: string; name: string; email: string };
  dueDate?: string;
  teamId?: string;
  meeting?: { _id: string; title: string } | null;
  history?: TaskHistoryEntry[];
  createdAt: string;
}

export interface TaskHistoryEntry {
  changedBy: { _id: string; name: string; avatar?: string };
  field: string;
  from: unknown;
  to: unknown;
  at: string;
}

export interface TaskActivity {
  _id: string;
  actor: { _id: string; name: string; avatar?: string };
  taskId: { _id: string; title: string };
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export const taskService = {
  list:            ()                              => api.get('/tasks'),
  create:          (data: Partial<Task>)           => api.post('/tasks', data),
  update:          (id: string, data: Partial<Task>) => api.put(`/tasks/${id}`, data),
  delete:          (id: string)                    => api.delete(`/tasks/${id}`),
  getHistory:      (id: string)                    => api.get(`/tasks/${id}/history`),
  // Team-scoped
  listByTeam:      (teamId: string)                => api.get(`/teams/${teamId}/tasks`),
  createTeamTask:  (teamId: string, data: Partial<Task>) => api.post('/tasks', { ...data, teamId }),
  updateTeamTask:  (id: string, data: Partial<Task>)     => api.put(`/tasks/${id}`, data),
  deleteTeamTask:  (id: string)                          => api.delete(`/tasks/${id}`),
  getTeamActivity: (teamId: string)                => api.get(`/teams/${teamId}/activity`),
};
