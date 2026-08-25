import logger from '../middleware/logger.js';
import { OtpDeliveryResult } from './email.service.js';

const RETRY_DELAYS_MS = [1000, 2000, 4000];

async function sendWithHttpApi(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<OtpDeliveryResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const payload = {
    sender: {
      name: process.env.BREVO_FROM_NAME || 'LoanFlow',
      email: process.env.BREVO_FROM_EMAIL || 'no-reply@loanflow.app',
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    replyTo: {
      email: replyTo || process.env.BREVO_FROM_EMAIL || 'no-reply@loanflow.app',
    },
  };

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Brevo API error ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { messageId?: string };
      logger.info({ to, messageId: data.messageId }, 'Email sent via Brevo HTTP API');
      return { success: true, messageId: data.messageId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn({ attempt, to, err: errorMessage }, 'Email send attempt failed');
      if (attempt === 3) {
        logger.error({ to, subject, attempt, err: errorMessage }, 'All email retry attempts exhausted');
        throw new Error(errorMessage);
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
  replyTo?: string,
): Promise<OtpDeliveryResult> {
  return sendWithHttpApi(to, subject, html, replyTo);
}

export function isBrevoConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY &&
    process.env.BREVO_FROM_EMAIL,
  );
}
