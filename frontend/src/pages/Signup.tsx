import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrength } from '../components/PasswordStrength';
import { User, Mail, Phone } from 'lucide-react';
import { signup, SignupData } from '../services/auth';

export default function Signup() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [signupForm, setSignupForm] = React.useState<SignupData>({
    fullName: '',
    email: '',
    mobile: '',
    countryCode: '+91',
    password: '',
    confirmPassword: '',
    role: 'BORROWER',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (signupForm.fullName.length < 2) e.fullName = 'Full name must be at least 2 characters';
    if (signupForm.fullName.length > 50) e.fullName = 'Full name must be at most 50 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email)) e.email = 'Invalid email address';
    if (signupForm.mobile && !/^[6-9]\d{9}$/.test(signupForm.mobile)) {
      e.mobile = 'Must be a valid 10-digit Indian mobile number starting with 6-9';
    }
    const passwordValid =
      signupForm.password.length >= 8 &&
      /[A-Z]/.test(signupForm.password) &&
      /[a-z]/.test(signupForm.password) &&
      /\d/.test(signupForm.password) &&
      /[^A-Za-z\d]/.test(signupForm.password);
    if (!passwordValid) e.password = 'Password does not meet all strength requirements';
    if (signupForm.password !== signupForm.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setIsSubmitting(true);
    try {
      await signup(signupForm);
      navigate('/login');
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ field?: string; message: string }>;
          };
          status?: number;
        };
      };
      if (error.response?.status === 429) {
        setErrors({ submit: 'Too many attempts. Please try again later.' });
      } else if (error.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const e of error.response.data.errors) {
          if (e.field) {
            fieldErrors[e.field] = e.message;
          }
        }
        setErrors({ ...fieldErrors, submit: error.response.data.message || 'Signup failed' });
      } else {
        const message = error.response?.data?.message || 'Signup failed';
        setErrors({ submit: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Your Account"
      description="Join LoanFlow today. Register once to get started."
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <p className="text-sm text-gray-600 mt-1">
            Fill in your details to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={signupForm.fullName}
                onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                className="pl-10"
                maxLength={50}
                required
              />
            </div>
            {errors.fullName && <p className="text-xs text-danger-500">{errors.fullName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={signupForm.email}
                onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                className="pl-10"
                required
              />
            </div>
            {errors.email && <p className="text-xs text-danger-500">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Mobile Number</Label>
            <div className="flex gap-2">
              <select
                value={signupForm.countryCode}
                onChange={(e) => setSignupForm({ ...signupForm, countryCode: e.target.value })}
                className="w-20 rounded-md border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="+91">🇮🇳 +91</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+61">🇦🇺 +61</option>
                <option value="+971">🇦🇪 +971</option>
              </select>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={signupForm.mobile}
                  onChange={(e) => setSignupForm({ ...signupForm, mobile: e.target.value })}
                  maxLength={10}
                  className="pl-10"
                />
              </div>
            </div>
            {errors.mobile && <p className="text-xs text-danger-500">{errors.mobile}</p>}
          </div>

          <div className="space-y-1.5">
            <PasswordInput
              label="Password"
              placeholder="Min 8 chars with upper, lower, number, special"
              value={signupForm.password}
              onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
              error={errors.password}
              required
            />
            <PasswordStrength password={signupForm.password} />
          </div>

          <div className="space-y-1.5">
            <PasswordInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={signupForm.confirmPassword}
              onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
              error={errors.confirmPassword}
              required
            />
          </div>

          {errors.submit && <p className="text-sm text-danger-500">{errors.submit}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
