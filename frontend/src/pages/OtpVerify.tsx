import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { OtpInput } from '../components/OtpInput';
import { useAuth } from '../services/authContext';
import { verifyOtpAndLogin } from '../services/auth';

export default function OtpVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const identifier = (location.state as { identifier?: string })?.identifier || '';

  const [otpValue, setOtpValue] = React.useState<string[]>(Array(6).fill(''));
  const [error, setError] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleComplete = async (code: string) => {
    setIsVerifying(true);
    setError('');
    try {
      const response = await verifyOtpAndLogin({
        identifier,
        code,
      });
      if (response.data.accessToken) {
        login(response.data.accessToken, response.data.refreshToken);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Invalid OTP code');
      setOtpValue(Array(6).fill(''));
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Enter OTP</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to {identifier}.
            Enter it below to complete login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OtpInput
            value={otpValue}
            onChange={setOtpValue}
            onComplete={handleComplete}
            error={error}
          />
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            onClick={handleResend}
            variant="link"
            className="w-full"
          >
            Didn't receive the code? Resend
          </Button>
          <Button
            onClick={() => navigate('/login')}
            variant="ghost"
            className="w-full"
          >
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
