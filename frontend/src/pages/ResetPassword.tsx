import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ResetPassword() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isSuccess, setIsSuccess] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const token = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }, [location.search]);

  React.useEffect(() => {
    if (!token) {
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      if (response.data.success) {
        setIsSuccess(true);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <AuthLayout
      title="Reset Your Password"
      description="Enter your new password below"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your new password must be at least 8 characters and include upper,
            lower, number, and special character.
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Password Reset Complete</h3>
            <p className="text-sm text-gray-600">
              Your password has been reset successfully. You can now log in
              with your new password.
            </p>
            <Link to="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
              required
            />

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error}
              required
            />

            {error && (
              <div className="flex items-center gap-2 text-sm text-danger-500">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-gray-600">
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Back to Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
