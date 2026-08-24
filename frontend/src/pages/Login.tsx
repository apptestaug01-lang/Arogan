import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { GoogleIcon, MicrosoftIcon } from '../components/icons';
import { useAuth } from '../services/authContext';
import { loginWithPassword, requestOtp, LoginPasswordData, OtpRequestData } from '../services/auth';
import { Eye, Lock, Mail, Phone } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = React.useState<'password' | 'otp'>('password');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [passwordForm, setPasswordForm] = React.useState<LoginPasswordData>({
    identifier: '',
    password: '',
  });
  const [passwordError, setPasswordError] = React.useState('');

  const [otpForm, setOtpForm] = React.useState<OtpRequestData>({
    identifier: '',
    channel: 'email',
  });
  const [otpError, setOtpError] = React.useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPasswordError('');
    try {
      const response = await loginWithPassword(passwordForm);
      if (response.data.accessToken) {
        login(response.data.accessToken, response.data.refreshToken);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setPasswordError(error.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setOtpError('');
    try {
      const response = await requestOtp(otpForm);
      if (response.success) {
        navigate('/otp', { state: { identifier: otpForm.identifier } });
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setOtpError(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      description="Sign in to your LoanFlow account to continue managing your loan applications."
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Login to Your Account</h2>
          <p className="text-sm text-gray-600 mt-1">
            Enter your credentials to access the platform
          </p>
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <Button
            variant={activeTab === 'password' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setActiveTab('password');
              setPasswordError('');
            }}
          >
            Password
          </Button>
          <Button
            variant={activeTab === 'otp' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => {
              setActiveTab('otp');
              setOtpError('');
            }}
          >
            OTP
          </Button>
        </div>

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">
                Email or Mobile Number
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder="you@example.com or 9876543210"
                  value={passwordForm.identifier}
                  onChange={(e) => setPasswordForm({ ...passwordForm, identifier: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              error={passwordError}
              required
            />

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="text-sm text-gray-700">Remember me</span>
              </Label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {passwordError && (
              <p className="text-sm text-danger-500">{passwordError}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        )}

        {activeTab === 'otp' && (
          <form onSubmit={handleOtpRequest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp-identifier" className="text-sm font-medium text-gray-700">
                Email or Mobile Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="otp-identifier"
                  type="text"
                  placeholder="you@example.com or 9876543210"
                  value={otpForm.identifier}
                  onChange={(e) => setOtpForm({ ...otpForm, identifier: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="otp-channel" className="text-sm font-medium text-gray-700">
                Delivery Method
              </Label>
              <select
                id="otp-channel"
                value={otpForm.channel}
                onChange={(e) => setOtpForm({ ...otpForm, channel: e.target.value as 'email' | 'sms' })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>

            {otpError && <p className="text-sm text-danger-500">{otpError}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending OTP...' : 'Send OTP & Continue'}
            </Button>
          </form>
        )}

        <div className="relative my-6">
          <Separator className="my-4" />
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-500">
            Or continue with
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" type="button" className="w-full">
            <GoogleIcon className="h-4 w-4 mr-2" />
            Google
          </Button>
          <Button variant="outline" type="button" className="w-full">
            <MicrosoftIcon className="h-4 w-4 mr-2" />
            Microsoft
          </Button>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
