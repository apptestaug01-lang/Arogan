import * as React from 'react';
import {
  logout as logoutApi,
  getCurrentUser as getCurrentUserApi,
} from './auth';
import api, { clearAuthTokens, setAuthTokens, refreshAccessToken } from './api';

export interface User {
  id: string;
  email: string;
  role: 'BORROWER' | 'ADMIN' | 'ANALYST' | 'APPROVER';
  fullName: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user?: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (storedToken) {
        setAccessToken(storedToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }

      if (storedRefreshToken) {
        try {
          const tokens = await refreshAccessToken();
          setAccessToken(tokens.accessToken);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
          setAccessToken(null);
          clearAuthTokens();
          setIsLoading(false);
          return;
        }
      }

      if (storedUser) {
        setUser(JSON.parse(storedUser) as User);
      }

      if (storedRefreshToken || storedToken) {
        await refreshUser();
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = React.useCallback(
    (tokens: { accessToken: string; refreshToken: string }, user?: User) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
      }
      setAccessToken(tokens.accessToken);
      setAuthTokens(tokens);
    },
    [],
  );

  const logout = React.useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // best-effort logout even if API fails
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      setAccessToken(null);
      clearAuthTokens();
    }
  }, []);

  const refreshUser = React.useCallback(async () => {
    try {
      const response = await getCurrentUserApi();
      if (response.data.user) {
        setUser(response.data.user as User);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    } catch {
      // token invalid, force logout
      await logout();
    }
  }, [logout]);

  return React.createElement(AuthContext.Provider, {
    value: { user, accessToken, isLoading, login, logout, refreshUser },
    children,
  });
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
