import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as authApi from '../src/services/auth';
import { AuthProvider, useAuth } from '../src/services/authContext';

jest.mock('../src/services/auth', () => ({
  signup: jest.fn(),
  loginWithPassword: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn().mockResolvedValue({
    success: true,
    data: {
      user: { id: 'u1', email: 'test@test.com', fullName: 'Test', role: 'BORROWER', emailVerified: true, isActive: true },
    },
  }),
  requestOtp: jest.fn(),
  verifyOtpAndLogin: jest.fn(),
}));

jest.mock('../src/services/api', () => {
  const mockFn = () => jest.fn();
  return {
    __esModule: true,
    default: {
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: mockFn() }, response: { use: mockFn() } },
    },
    setAuthTokens: mockFn(),
    clearAuthTokens: mockFn(),
    refreshAccessToken: mockFn(),
  };
});

const apiMock = require('../src/services/api');

const TestComponent = () => {
  const { user, accessToken, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="user-id">{user?.id || 'no-user'}</span>
      <span data-testid="access-token">{accessToken || 'no-token'}</span>
      <button
        data-testid="login-btn"
        onClick={() => login({ accessToken: 'test-token', refreshToken: 'refresh' }, { id: 'u1', email: 'test@test.com', fullName: 'Test', role: 'BORROWER', emailVerified: true, isActive: true } as any)}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    apiMock.refreshAccessToken.mockResolvedValue({ accessToken: 'refreshed-token', refreshToken: 'stored-refresh' });
    (authApi.getCurrentUser as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        user: { id: 'u1', email: 'test@test.com', fullName: 'Test', role: 'BORROWER', emailVerified: true, isActive: true },
      },
    });
  });

  it('should show no user state initially', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(screen.getByTestId('user-id').textContent).toBe('no-user');
    expect(screen.getByTestId('access-token').textContent).toBe('no-token');
  });

  it('should initialize from localStorage', async () => {
    localStorage.setItem('accessToken', 'stored-token');
    localStorage.setItem('refreshToken', 'stored-refresh');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'test@test.com', role: 'BORROWER', fullName: 'Test', emailVerified: true, isActive: true }));

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u1');
      expect(screen.getByTestId('access-token').textContent).toBe('refreshed-token');
    });
  });

  it('should store tokens and user on login', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('no-user');
    });

    fireEvent.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u1');
      expect(screen.getByTestId('access-token').textContent).toBe('test-token');
      expect(localStorage.getItem('accessToken')).toBe('test-token');
      expect(localStorage.getItem('refreshToken')).toBe('refresh');
    });
  });

  it('should clear tokens and user on logout', async () => {
    (authApi.logout as jest.Mock).mockResolvedValue(undefined);

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('no-user');
    });

    fireEvent.click(screen.getByTestId('login-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('u1');
    });

    fireEvent.click(screen.getByTestId('logout-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('user-id').textContent).toBe('no-user');
      expect(screen.getByTestId('access-token').textContent).toBe('no-token');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });
});
