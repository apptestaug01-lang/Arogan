import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '../components/AuthLayout';
import { Mail } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = React.useState('');

  return (
    <AuthLayout
      title="Reset Your Password"
      description="Enter your email address and we'll help you reset your password."
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Forgot Password</h2>
          <p className="text-sm text-gray-600 mt-1">
            Enter your email to request a password reset link
          </p>
        </div>

        <form className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full">
            Send Reset Link
          </Button>
        </form>

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
