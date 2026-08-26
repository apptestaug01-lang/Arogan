import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../src/services/authContext';
import Signup from '../src/pages/Signup';

jest.mock('../src/services/auth', () => ({
  signup: jest.fn(),
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

const renderSignup = () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <Signup />
      </AuthProvider>
    </BrowserRouter>,
  );
};

describe('Signup page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render signup form', () => {
    renderSignup();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('9876543210')).toBeInTheDocument();
  });

  it('should not show role selector (only BORROWER allowed)', () => {
    renderSignup();
    expect(screen.queryByText('Select Role')).not.toBeInTheDocument();
  });

  describe('frontend validation', () => {
    it('should show error when fullName is empty', async () => {
      renderSignup();
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText('Full name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should show error when fullName exceeds 50 characters', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), {
        target: { value: 'a'.repeat(51) },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText('Full name must be at most 50 characters')).toBeInTheDocument();
      });
    });

    it('should show error for invalid email format', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'invalid-email' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('should show error when email is empty', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('should show error for invalid mobile number', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '12345' } });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(
          screen.getByText('Must be a valid 10-digit Indian mobile number starting with 6-9'),
        ).toBeInTheDocument();
      });
    });

    it('should show error for weak password', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'weak' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(
          screen.getByText('Password does not meet all strength requirements'),
        ).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'DifferentPass1!' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });
  });

  describe('API error handling', () => {
    it('should display email already registered error from backend', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockRejectedValue({
        response: {
          status: 409,
          data: { message: 'Email already registered' },
        },
      });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    });

    it('should display mobile already registered error from backend', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockRejectedValue({
        response: {
          status: 409,
          data: { message: 'Mobile number already registered' },
        },
      });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Mobile number already registered')).toBeInTheDocument();
    });

    it('should display field-specific validation errors from backend', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockRejectedValue({
        response: {
          status: 400,
          data: {
            message: 'Validation failed',
            errors: [
              { field: 'email', message: 'Invalid email address' },
              { field: 'password', message: 'Password must be at least 8 characters' },
            ],
          },
        },
      });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Validation failed')).toBeInTheDocument();
      expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
      expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should display rate limit error', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'Too many requests' },
        },
      });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Too many attempts. Please try again later.')).toBeInTheDocument();
    });

    it('should display generic error when no message is provided', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockRejectedValue({
        response: {
          status: 500,
          data: {},
        },
      });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Signup failed')).toBeInTheDocument();
    });
  });

  describe('successful signup', () => {
    it('should call signup and navigate to login on success', async () => {
      const { signup: mockSignup } = require('../src/services/auth');
      mockSignup.mockResolvedValue({ success: true });

      renderSignup();
      fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'John Doe' } });
      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'john@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('9876543210'), { target: { value: '9876543210' } });
      fireEvent.change(screen.getByPlaceholderText('Min 8 chars with upper, lower, number, special'), {
        target: { value: 'Str0ng!Pass' },
      });
      fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
        target: { value: 'Str0ng!Pass' },
      });
      const form = screen.getByPlaceholderText('John Doe').closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'John Doe',
            email: 'john@example.com',
            mobile: '9876543210',
            countryCode: '+91',
            password: 'Str0ng!Pass',
            confirmPassword: 'Str0ng!Pass',
            role: 'BORROWER',
          }),
        );
      });
    });
  });
});
