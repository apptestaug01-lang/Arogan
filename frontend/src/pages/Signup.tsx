import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrength } from '../components/PasswordStrength';
import { User, Mail, Phone, ChevronDown } from 'lucide-react';
import { signup, SignupData } from '../services/auth';

export type Role = 'BORROWER' | 'ADMIN' | 'ANALYST' | 'APPROVER';

const roleLabels: Record<Role, string> = {
  BORROWER: 'Borrower',
  ADMIN: 'Admin',
  ANALYST: 'Credit Analyst',
  APPROVER: 'Credit Approver',
};

const roleDescriptions: Record<Role, string> = {
  BORROWER: 'Individual or business applying for loans',
  ADMIN: 'System administration and user management',
  ANALYST: 'Review and assess loan applications',
  APPROVER: 'Make final loan approval decisions',
};

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
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || 'Signup failed';
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Your Account"
      description="Join LoanFlow today. Register once and select your role to access role-specific features."
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
              <Input
                type="text"
                placeholder="+91"
                value={signupForm.countryCode}
                onChange={(e) => setSignupForm({ ...signupForm, countryCode: e.target.value })}
                className="w-16"
              />
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
              error={errors.password || errors.submit}
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

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Select Role</Label>
            <div className="relative">
              <select
                value={signupForm.role}
                onChange={(e) => setSignupForm({ ...signupForm, role: e.target.value as Role })}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
                required
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {roleDescriptions[signupForm.role as Role]}
            </p>
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
