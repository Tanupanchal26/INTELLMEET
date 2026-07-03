import api from './axios';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority?: 'high' | 'medium' | 'low' | 'urgent';
  assignedTo?: { name: string; email: string };
  dueDate?: string;
  createdAt: string;
}

const listTasks = () => api.get('/tasks');

export const taskService = {
  list: listTasks,
  create: (data: Partial<Task>) => api.post('/tasks', data),
  update: (id: string, data: Partial<Task>) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};
