import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '../components/AuthLayout';
import { OtpInput } from '../components/OtpInput';
import { Shield } from 'lucide-react';
import { useAuth } from '../services/authContext';
import { requestOtp, verifyOtpAndLogin } from '../services/auth';
import type { OtpRequestData } from '../services/auth';

export default function OtpVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const identifier = (location.state as { identifier?: string; channel?: 'email' | 'sms' })?.identifier || '';
  const channel = (location.state as { identifier?: string; channel?: 'email' | 'sms' })?.channel || 'email';

  const [otpValue, setOtpValue] = React.useState<string[]>(Array(6).fill(''));
  const [error, setError] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (!identifier) {
      navigate('/login');
    }
  }, [identifier, channel, navigate]);

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleComplete = async (code: string) => {
    setIsVerifying(true);
    setError('');
    try {
      const response = await verifyOtpAndLogin({
        identifier,
        code,
      });
      if (response.data.accessToken) {
        login(
          { accessToken: response.data.accessToken, refreshToken: response.data.refreshToken },
          response.data.user,
        );
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Invalid OTP code');
      setOtpValue(Array(6).fill(''));
      setTimeout(() => {
        inputRefs.current?.[0]?.focus();
      }, 150);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setOtpValue(Array(6).fill(''));
    try {
      const otpData: OtpRequestData = {
        identifier,
        channel,
      };
      await requestOtp(otpData);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to resend OTP');
    }
  };

  if (!identifier) {
    return null;
  }

  return (
    <AuthLayout
      title="Verify Your Identity"
      description="Enter the 6-digit code sent to your email or mobile number to complete authentication."
    >
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-primary-50 rounded-full">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Enter OTP</h2>
          <p className="text-sm text-gray-600 mt-2">
            We've sent a 6-digit code to{' '}
            <span className="font-medium text-gray-800">{identifier}</span>
          </p>
        </div>

        <div className="flex justify-center">
          <OtpInput
            value={otpValue}
            onChange={setOtpValue}
            onComplete={handleComplete}
            error={error}
            disabled={isVerifying}
            ref={inputRefs}
          />
        </div>

        {isVerifying && (
          <p className="text-sm text-gray-500 animate-pulse">
            Verifying your code...
          </p>
        )}

        <Button
          variant="ghost"
          className="w-full"
          onClick={handleResend}
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : "Didn't receive the code? Resend"}
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/login')}
        >
          Back to Login
        </Button>
      </div>
    </AuthLayout>
  );
}
