import * as React from 'react';
import { Lock } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 p-4">
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-center gap-1 mb-6">
          <Lock className="h-8 w-8 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900">LoanFlow</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 shadow-2xl rounded-2xl overflow-hidden bg-card">
          <div className="hidden md:flex flex-col justify-center bg-gradient-to-br from-primary-600 to-primary-800 p-10 text-white">
            <h1 className="text-4xl font-extrabold mb-4">{title}</h1>
            {description && (
              <p className="text-lg text-primary-100 leading-relaxed">{description}</p>
            )}
            <div className="mt-8 space-y-3 text-sm text-primary-200">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-300 rounded-full" />
                Secure authentication for all user roles
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-300 rounded-full" />
                OTP and password-based login
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-300 rounded-full" />
                Role-based access control
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-8 sm:p-12">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
