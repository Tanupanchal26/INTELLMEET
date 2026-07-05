import api from './axios';
import type { User } from '../store/auth/auth.slice';

export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload { name: string; email: string; password: string; }

// The axios interceptor unwraps res.data, so the shape here is the ApiResponse
// envelope: { success: boolean; data: T; message: string }
export interface ApiEnvelope<T> { success: boolean; data: T; message: string; }

export const authService = {
  login:        (data: LoginPayload)    => api.post<never, ApiEnvelope<{ user: User; accessToken: string }>>('/auth/login', data),
  register:     (data: RegisterPayload) => api.post<never, ApiEnvelope<{ user: User; accessToken: string }>>('/auth/signup', data),
  logout:       ()                      => api.post('/auth/logout'),
  refreshToken: ()                      => api.post<never, ApiEnvelope<{ accessToken: string; user: User }>>('/auth/refresh-token', {}),
  // /users/me returns { success, data: User, message } after interceptor unwrap
  me:           ()                      => api.get<never, ApiEnvelope<User>>('/users/me'),
};
