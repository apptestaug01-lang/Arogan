import { OTPRequest, OtpChannel } from '@prisma/client';
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
} from '../utils/constants.js';

export interface OtpResult {
  success: boolean;
  message: string;
  code?: string;
}

export async function storeOtp(
  identifier: string,
  channel: OtpChannel,
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
