import logger from '../middleware/logger.js';

export interface OtpDeliveryResult {
  success: boolean;
  messageId?: string;
}

export interface OtpProvider {
  sendEmail(to: string, subject: string, body: string): Promise<OtpDeliveryResult>;
  sendSms(to: string, body: string): Promise<OtpDeliveryResult>;
}

class NoopOtpProvider implements OtpProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<OtpDeliveryResult> {
    logger.info({ to, subject, body }, 'OTP email (noop provider - configure real provider in production)');
    if (process.env.NODE_ENV === 'development') {
      return { success: true, messageId: `dev-email-${Date.now()}` };
    }
    return { success: true, messageId: `noop-${Date.now()}` };
  }

  async sendSms(to: string, body: string): Promise<OtpDeliveryResult> {
    logger.info({ to, body }, 'OTP SMS (noop provider - configure Twilio in production)');
    if (process.env.NODE_ENV === 'development') {
      return { success: true, messageId: `dev-sms-${Date.now()}` };
    }
    return { success: true, messageId: `noop-${Date.now()}` };
  }
}

const emailProvider: OtpProvider = new NoopOtpProvider();

export async function sendOtpEmail(
  email: string,
  code: string,
  fullName?: string,
): Promise<OtpDeliveryResult> {
  const subject = 'Your LoanFlow Verification Code';
  const body = `Hi ${fullName || ''},\n\nYour verification code is: ${code}\n\nThis code expires in 60 seconds.\n\n- LoanFlow Team`;
  return emailProvider.sendEmail(email, subject, body);
}

export async function sendOtpSms(
  mobile: string,
  code: string,
): Promise<OtpDeliveryResult> {
  const body = `Your LoanFlow verification code is: ${code}. This code expires in 60 seconds.`;
  return emailProvider.sendSms(mobile, body);
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
): Promise<OtpDeliveryResult> {
  const subject = 'LoanFlow Password Reset Instructions';
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const body = `You requested a password reset for your LoanFlow account.\n\nClick the link below to reset your password:\n\n${resetUrl}\n\nThis link expires in 30 minutes.\n\nIf you did not request this, please ignore this email.\n\n- LoanFlow Team`;
  return emailProvider.sendEmail(email, subject, body);
}
