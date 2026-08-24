import nodemailer from 'nodemailer';
import logger from '../middleware/logger.js';
import { OtpDeliveryResult } from './email.service.js';

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_PASS || '',
  },
});

const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function sendWithRetry(
  to: string,
  subject: string,
  html: string,
): Promise<OtpDeliveryResult> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${process.env.BREVO_FROM_NAME || 'LoanFlow'}" <${process.env.BREVO_FROM_EMAIL || 'no-reply@loanflow.app'}>`,
        to,
        subject,
        html,
        replyTo: process.env.BREVO_REPLY_TO || process.env.BREVO_FROM_EMAIL,
      });
      logger.info({ to, messageId: info.messageId }, 'Email sent via Brevo SMTP');
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.warn({ attempt, to, err: err instanceof Error ? err.message : String(err) }, 'Email send attempt failed');
      if (attempt === 3) {
        logger.error({ to, subject, attempt }, 'All email retry attempts exhausted');
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw new Error('Unreachable');
}

export async function sendEmailViaBrevo(
  to: string,
  subject: string,
  html: string,
): Promise<OtpDeliveryResult> {
  return sendWithRetry(to, subject, html);
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS && process.env.BREVO_FROM_EMAIL);
}
