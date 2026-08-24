import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const VITE_API_URL: string | undefined =
  typeof process !== 'undefined' && process.env?.VITE_API_URL
    ? process.env.VITE_API_URL
    : undefined;

const api: AxiosInstance = axios.create({
  baseURL: VITE_API_URL || '/api',
  withCredentials: true,
});

interface TokenRefreshPromise {
  resolve: (config: InternalAxiosRequestConfig) => void;
  reject: (error: unknown) => void;
  config: InternalAxiosRequestConfig;
}

let isRefreshing = false;
let refreshQueue: TokenRefreshPromise[] = [];

function processQueue(token: string | null): void {
  refreshQueue.forEach((prom) => {
    if (token) {
      prom.resolve({
        ...prom.config,
        headers: { ...(prom.config.headers as Record<string, string>), Authorization: `Bearer ${token}` },
      } as InternalAxiosRequestConfig);
    } else {
      prom.reject(new Error('Token refresh failed'));
    }
  });
  refreshQueue = [];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function setAuthTokens(tokens: AuthTokens): void {
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
}

export function clearAuthTokens(): void {
  delete api.defaults.headers.common['Authorization'];
}

export async function refreshAccessToken(): Promise<AuthTokens> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post<AuthTokens>(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken },
    { withCredentials: true },
  );

  const tokens = response.data;
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

  return tokens;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<InternalAxiosRequestConfig>((resolve, reject) => {
          refreshQueue.push({
            resolve: (config) => resolve(config),
            reject: (err) => reject(err),
            config: originalRequest,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const tokens = await refreshAccessToken();
        const newToken = tokens.accessToken;
        processQueue(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(null);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-error'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-error'));
      }
    }

    return Promise.reject(error);
  },
);

export default api;
