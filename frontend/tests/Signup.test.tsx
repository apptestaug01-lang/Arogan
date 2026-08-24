import { render, screen, fireEvent } from '@testing-library/react';
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

describe('Signup page', () => {
  it('should render signup form', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Signup />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('9876543210')).toBeInTheDocument();
  });

  it('should not show role selector (only BORROWER allowed)', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <Signup />
        </AuthProvider>
      </BrowserRouter>,
    );

    expect(screen.queryByText('Select Role')).not.toBeInTheDocument();
  });
});
