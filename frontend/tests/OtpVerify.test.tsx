import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../src/services/authContext';
import OtpVerify from '../src/pages/OtpVerify';
import { requestOtp, verifyOtpAndLogin } from '../src/services/auth';

jest.mock('../src/services/auth', () => ({
  requestOtp: jest.fn().mockResolvedValue({ success: true, message: 'OTP sent' }),
  verifyOtpAndLogin: jest.fn().mockResolvedValue({
    data: {
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      user: { id: 'u1', email: 'test@example.com', fullName: 'Test', role: 'BORROWER' },
    },
  }),
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

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: jest.fn(),
}));

describe('OtpVerify page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    (require('react-router-dom').useLocation as jest.Mock).mockReturnValue({
      state: { identifier: 'test@example.com', channel: 'email' },
    });
  });

  const renderOtpVerify = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <OtpVerify />
        </AuthProvider>
      </BrowserRouter>,
    );
  };

  it('should render OTP verification form with identifier', () => {
    renderOtpVerify();

    expect(screen.getByText('Enter OTP')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verify Your Identity')).toBeInTheDocument();
  });

  it('should redirect to login if no identifier in state', () => {
    (require('react-router-dom').useLocation as jest.Mock).mockReturnValue({
      state: {},
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <OtpVerify />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should call verifyOtpAndLogin when OTP is complete', async () => {
    const { verifyOtpAndLogin } = require('../src/services/auth');
    renderOtpVerify();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '1' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    fireEvent.change(inputs[3], { target: { value: '4' } });
    fireEvent.change(inputs[4], { target: { value: '5' } });
    fireEvent.change(inputs[5], { target: { value: '6' } });

    await waitFor(() => {
      expect(verifyOtpAndLogin).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        code: '123456',
      });
    });
  });

  it('should call requestOtp with correct channel on resend', async () => {
    const { requestOtp } = require('../src/services/auth');
    renderOtpVerify();

    fireEvent.click(screen.getByText("Didn't receive the code? Resend"));

    await waitFor(() => {
      expect(requestOtp).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        channel: 'email',
      });
    });
  });

  it('should navigate back to login when back button is clicked', () => {
    renderOtpVerify();

    fireEvent.click(screen.getByText('Back to Login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
