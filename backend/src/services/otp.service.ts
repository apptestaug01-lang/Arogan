import { OtpChannel, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  generateOtp,
  hashOtp,
  compareOtp,
} from '../utils/crypto.js';
import {
  OTP_EXPIRY_SECONDS,
  OTP_MAX_REQUESTS,
  OTP_WINDOW_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
} from '../utils/constants.js';
import { sendOtpEmail, sendOtpSms } from './email.service.js';
import logger from '../middleware/logger.js';

export interface OtpResult {
  success: boolean;
  message: string;
  code?: string;
}

interface StoreOtpOptions {
  fullName?: string;
  user?: User | null;
}

export async function storeOtp(
  identifier: string,
  channel: OtpChannel,
  options?: StoreOtpOptions,
): Promise<OtpResult> {
  const recentOtpCount = await prisma.oTPRequest.count({
    where: {
      identifier,
      createdAt: {
        gte: new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000),
      },
    },
  });

  if (recentOtpCount >= OTP_MAX_REQUESTS) {
    return {
      success: false,
      message: 'Too many OTP requests. Please try again later.',
    };
  }

  const lastOtp = await prisma.oTPRequest.findFirst({
    where: { identifier },
    orderBy: { createdAt: 'desc' },
  });

  if (lastOtp && (Date.now() - lastOtp.createdAt.getTime()) < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return {
      success: false,
      message: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.`,
    };
  }

  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

  await prisma.oTPRequest.create({
    data: {
      identifier,
      codeHash,
      channel,
      expiresAt,
    },
  });

  let deliverySuccess = true;
  try {
    if (channel === OtpChannel.EMAIL) {
      await sendOtpEmail(identifier, otp, options?.fullName);
    } else {
      await sendOtpSms(identifier, otp);
    }
  } catch (err) {
    deliverySuccess = false;
    logger.error({ err: { message: err instanceof Error ? err.message : String(err) } }, 'OTP delivery failed');
  }

  if (!deliverySuccess && process.env.NODE_ENV === 'production') {
    return {
      success: false,
      message: 'Failed to send OTP. Please try again later.',
    };
  }

  return {
    success: true,
    message: `OTP sent to ${identifier}`,
    code: process.env.NODE_ENV === 'development' ? otp : undefined,
  };
}

export async function verifyOtp(
  identifier: string,
  code: string,
): Promise<OtpResult> {
  const otpRecord = await prisma.oTPRequest.findFirst({
    where: {
      identifier,
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    return {
      success: false,
      message: 'Invalid or expired OTP',
    };
  }

  if (otpRecord.attemptCount >= 3) {
    return {
      success: false,
      message: 'Too many failed attempts. Please request a new OTP.',
    };
  }

  if (!compareOtp(code, otpRecord.codeHash)) {
    await prisma.oTPRequest.update({
      where: { id: otpRecord.id },
      data: { attemptCount: { increment: 1 } },
    });
    return {
      success: false,
      message: 'Invalid OTP code',
    };
  }

  await prisma.oTPRequest.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return {
    success: true,
    message: 'OTP verified successfully',
  };
}
