import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordStrength } from '../components/PasswordStrength';
import { useAuth } from '../services/authContext';
import { signup, loginWithPassword, requestOtp, SignupData, LoginPasswordData, OtpRequestData } from '../services/auth';
export type Role = 'BORROWER' | 'ADMIN' | 'ANALYST' | 'APPROVER';

const roleLabels: Record<Role, string> = {
  BORROWER: 'Borrower',
  ADMIN: 'Admin',
  ANALYST: 'Credit Analyst',
  APPROVER: 'Credit Approver',
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'password' | 'otp'>('password');

  // Password login form state
  const [passwordForm, setPasswordForm] = React.useState({
    identifier: '',
    password: '',
  });
  const [passwordError, setPasswordError] = React.useState('');

  // Signup form state
  const [signupForm, setSignupForm] = React.useState<SignupData>({
    fullName: '',
    email: '',
    mobile: '',
    countryCode: '+91',
    password: '',
    confirmPassword: '',
    role: 'BORROWER',
  });
  const [signupErrors, setSignupErrors] = React.useState<Record<string, string>>({});

  // OTP request form state
  const [otpForm, setOtpForm] = React.useState<OtpRequestData>({
    identifier: '',
    channel: 'email',
  });
  const [otpError, setOtpError] = React.useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await loginWithPassword(passwordForm);
      if (response.data.accessToken) {
        login(response.data.accessToken, response.data.refreshToken);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setPasswordError(error.response?.data?.message || 'Invalid credentials');
    }
  };

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await requestOtp(otpForm);
      if (response.success) {
        navigate('/otp', { state: { identifier: otpForm.identifier } });
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setOtpError(error.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (signupForm.fullName.length < 2) errors.fullName = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) errors.email = 'Invalid email address';
    if (signupForm.mobile && !/^[6-9]\d{9}$/.test(signupForm.mobile)) errors.mobile = 'Must be a valid Indian mobile number';
    if (signupForm.password !== signupForm.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    const passwordValid =
      signupForm.password.length >= 8 &&
      /[A-Z]/.test(signupForm.password) &&
      /[a-z]/.test(signupForm.password) &&
      /\d/.test(signupForm.password) &&
      /[^A-Za-z\d]/.test(signupForm.password);
    if (!passwordValid) errors.password = 'Password does not meet strength requirements';

    setSignupErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await signup(signupForm);
      navigate('/login');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Signup failed';
      setSignupErrors({ submit: message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Tabs value={activeTab === 'password' ? 'password' : 'otp'} className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password" onClick={() => setActiveTab('password')}>
            Password
          </TabsTrigger>
          <TabsTrigger value="otp" onClick={() => setActiveTab('otp')}>
            OTP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Login with Password</CardTitle>
              <CardDescription>
                Enter your email or mobile number and password to continue.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Mobile</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="you@example.com or 9876543210"
                    value={passwordForm.identifier}
                    onChange={(e) => setPasswordForm({ ...passwordForm, identifier: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    required
                  />
                </div>
                {passwordError && <p className="text-sm text-danger-500">{passwordError}</p>}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button type="submit" className="w-full">
                  Login
                </Button>
                <Link to="/signup" className="text-sm text-primary-600 hover:underline">
                  Don't have an account? Sign up
                </Link>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="otp">
          <Card>
            <CardHeader>
              <CardTitle>Login with OTP</CardTitle>
              <CardDescription>
                Enter your email or mobile number to receive an OTP.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleOtpRequest}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-identifier">Email or Mobile</Label>
                  <Input
                    id="otp-identifier"
                    type="text"
                    placeholder="you@example.com or 9876543210"
                    value={otpForm.identifier}
                    onChange={(e) => setOtpForm({ ...otpForm, identifier: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp-channel">Delivery Method</Label>
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
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full">
                  Send OTP
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>
            Create a new account — choose your role during registration.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignupSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={signupForm.fullName}
                onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                required
                maxLength={50}
              />
              {signupErrors.fullName && <p className="text-xs text-danger-500">{signupErrors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={signupForm.email}
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                required
              />
              {signupErrors.email && <p className="text-xs text-danger-500">{signupErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <div className="flex gap-2">
                <Input
                  id="countryCode"
                  type="text"
                  placeholder="+91"
                  value={signupForm.countryCode}
                  onChange={(e) => setSignupForm({ ...signupForm, countryCode: e.target.value })}
                  className="w-20"
                />
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="9876543210"
                  value={signupForm.mobile}
                  onChange={(e) => setSignupForm({ ...signupForm, mobile: e.target.value })}
                  maxLength={10}
                />
              </div>
              {signupErrors.mobile && <p className="text-xs text-danger-500">{signupErrors.mobile}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 chars, upper, lower, number, special"
                value={signupForm.password}
                onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                required
                minLength={8}
              />
              <PasswordStrength password={signupForm.password} />
              {signupErrors.password && <p className="text-xs text-danger-500">{signupErrors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={signupForm.confirmPassword}
                onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                required
              />
              {signupErrors.confirmPassword && <p className="text-xs text-danger-500">{signupErrors.confirmPassword}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={signupForm.role}
                onChange={(e) => setSignupForm({ ...signupForm, role: e.target.value as Role })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {signupErrors.submit && <p className="text-sm text-danger-500">{signupErrors.submit}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
