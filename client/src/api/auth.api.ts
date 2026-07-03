import api from './axios';
import type { User } from '../store/auth/auth.slice';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; password: string; }

export const authService = {
  login: (data: LoginPayload) => api.post('/auth/login', data),
  register: (data: RegisterPayload) => api.post('/auth/signup', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<never, { data: User }>('/users/me'),
};
