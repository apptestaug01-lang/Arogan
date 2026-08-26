import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../src/services/authContext';
import Login from '../src/pages/Login';

jest.mock('../src/services/auth', () => ({
  loginWithPassword: jest.fn(),
  requestOtp: jest.fn().mockResolvedValue({ success: true, message: 'OTP sent' }),
}));

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  setAuthTokens: jest.fn(),
  clearAuthTokens: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

describe('Login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form with password tab by default', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(screen.getByRole('button', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OTP' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com or 9876543210')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('should render OTP tab when selected', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByText('OTP'));

    expect(screen.getByPlaceholderText('you@example.com or 9876543210')).toBeInTheDocument();
    expect(screen.getByText('Send OTP & Continue')).toBeInTheDocument();
  });

  it('should call requestOtp with identifier and channel on OTP submit', async () => {
    const { requestOtp } = require('../src/services/auth');

    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByText('OTP'));

    const identifierInput = screen.getByPlaceholderText('you@example.com or 9876543210');
    const channelSelect = screen.getByLabelText('Delivery Method');
    const submitButton = screen.getByText('Send OTP & Continue');

    fireEvent.change(identifierInput, { target: { value: 'test@example.com' } });
    fireEvent.change(channelSelect, { target: { value: 'sms' } });
    fireEvent.click(submitButton);

    expect(requestOtp).toHaveBeenCalledWith({
      identifier: 'test@example.com',
      channel: 'sms',
    });
  });

  it('should trim whitespace from identifier inputs', async () => {
    const { requestOtp } = require('../src/services/auth');

    render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByText('OTP'));

    const identifierInput = screen.getByPlaceholderText('you@example.com or 9876543210');
    fireEvent.change(identifierInput, { target: { value: '  test@example.com  ' } });
    fireEvent.click(screen.getByText('Send OTP & Continue'));

    expect(requestOtp).toHaveBeenCalledWith({
      identifier: 'test@example.com',
      channel: 'email',
    });
  });
});
