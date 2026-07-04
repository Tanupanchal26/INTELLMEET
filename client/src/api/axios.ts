import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../constants';

interface RetryableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const axiosClient = axios.create({
  baseURL:         API_BASE_URL,
  headers:         { 'Content-Type': 'application/json' },
  timeout:         60000,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token!));
  failedQueue = [];
};

// ── Request: attach Bearer token ─────────────────────────────────────────────
axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: unwrap data + handle 401 refresh ───────────────────────────────
axiosClient.interceptors.response.use(
  (res) => res.data,   // unwrap — controllers return ApiResponse envelope
  async (error) => {
    const original = (error.config ?? {}) as RetryableConfig;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${token}` };
          return axiosClient(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        // Use raw axios (not axiosClient) to avoid the response interceptor re-running
        const refreshed = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        // Raw axios response: refreshed.data is the ApiResponse envelope
        const newToken: string =
          refreshed.data?.data?.accessToken ??
          refreshed.data?.accessToken;

        if (!newToken) throw new Error('No token in refresh response');

        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);
        window.dispatchEvent(new CustomEvent('auth:tokenRefreshed', { detail: newToken }));
        processQueue(null, newToken);
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
        return axiosClient(original);
      } catch (refreshErr: any) {
        processQueue(refreshErr, null);
        // Only force logout when the refresh endpoint itself returns 401/403
        // (token truly invalid/revoked). Network errors, 5xx, etc. should NOT
        // log the user out — they may just be temporary server issues.
        const refreshStatus = refreshErr?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER);
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error   ||
      error.message                 ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
