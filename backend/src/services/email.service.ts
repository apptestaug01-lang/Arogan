import logger from '../middleware/logger.js';
import { sendEmailViaBrevo, sendSmsViaBrevo, isBrevoConfigured } from './brevoEmailProvider.js';
import {
  renderOtpTemplate,
  renderPasswordResetTemplate,
  renderWelcomeTemplate,
  renderLoginNotificationTemplate,
  renderPasswordChangedTemplate,
} from '../templates/emailTemplates.js';

export interface OtpDeliveryResult {
  success: boolean;
  messageId?: string;
}

export interface OtpProvider {
  sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<OtpDeliveryResult>;
  sendSms(to: string, body: string): Promise<OtpDeliveryResult>;
}

class NoopOtpProvider implements OtpProvider {
  async sendEmail(to: string, subject: string, html: string, _replyTo?: string): Promise<OtpDeliveryResult> {
    logger.info({ to, subject, html }, 'OTP email (noop provider - configure real provider in production)');
    if (process.env.NODE_ENV === 'development') {
      return { success: true, messageId: `dev-email-${Date.now()}` };
    }
    return { success: true, messageId: `noop-${Date.now()}` };
  }

  async sendSms(_to: string, body: string): Promise<OtpDeliveryResult> {
    logger.info({ body }, 'OTP SMS (noop provider - configure Twilio in production)');
    return { success: true, messageId: `dev-sms-${Date.now()}` };
  }
}

function createSmsSender(): (to: string, body: string) => Promise<OtpDeliveryResult> {
  const smsEnabled = process.env.BREVO_SMS_ENABLED === 'true';
  if (smsEnabled && isBrevoConfigured()) {
    return (to: string, body: string) => sendSmsViaBrevo(to, body);
  }
  return () => Promise.reject(new Error('SMS not configured'));
}

export const emailProvider: OtpProvider = (() => {
  const smsSender = createSmsSender();

  if (process.env.NODE_ENV === 'production') {
    if (!isBrevoConfigured()) {
      throw new Error('Brevo SMTP must be configured in production');
    }
    return {
      sendEmail: (to, subject, html, replyTo) => sendEmailViaBrevo(to, subject, html, replyTo),
      sendSms: smsSender,
    };
  }

  if (isBrevoConfigured()) {
    return {
      sendEmail: (to, subject, html, replyTo) => sendEmailViaBrevo(to, subject, html, replyTo),
      sendSms: smsSender,
    };
  }

  return new NoopOtpProvider();
})();

export async function sendOtpEmail(
  email: string,
  code: string,
  fullName?: string,
): Promise<OtpDeliveryResult> {
  const subject = 'Your LoanFlow Verification Code';
  const html = renderOtpTemplate(fullName || 'there', code);
  return emailProvider.sendEmail(email, subject, html, email);
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
  fullName?: string,
): Promise<OtpDeliveryResult> {
  const subject = 'LoanFlow Password Reset Instructions';
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const html = renderPasswordResetTemplate(fullName || 'there', resetUrl);
  return emailProvider.sendEmail(email, subject, html, email);
}

export async function sendWelcomeEmail(
  email: string,
  fullName: string,
): Promise<OtpDeliveryResult> {
  const subject = 'Welcome to LoanFlow!';
  const html = renderWelcomeTemplate(fullName);
  return emailProvider.sendEmail(email, subject, html, email);
}

export async function sendLoginNotificationEmail(
  email: string,
  fullName: string,
  ip?: string,
  userAgent?: string,
): Promise<OtpDeliveryResult> {
  const subject = 'New Login to LoanFlow';
  const html = renderLoginNotificationTemplate(
    fullName,
    ip || 'unknown',
    userAgent || 'unknown',
    new Date().toISOString(),
  );
  return emailProvider.sendEmail(email, subject, html, email);
}

export async function sendPasswordChangedEmail(
  email: string,
  fullName: string,
): Promise<OtpDeliveryResult> {
  const subject = 'Your LoanFlow Password Was Changed';
  const html = renderPasswordChangedTemplate(fullName);
  return emailProvider.sendEmail(email, subject, html, email);
}
