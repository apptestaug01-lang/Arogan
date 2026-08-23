import { Role, OtpChannel } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { generateTokenPair, verifyRefreshToken } from './token.service.js';
import { storeOtp, verifyOtp } from './otp.service.js';
import { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from '../utils/constants.js';

export interface SignupData {
  fullName: string;
  email: string;
  mobile?: string;
  countryCode: string;
  password: string;
  role: Role;
}

export interface LoginPasswordData {
  identifier: string;
  password: string;
}

export interface LoginOtpRequestData {
  identifier: string;
  channel: 'email' | 'sms';
}

export interface LoginOtpVerifyData {
  identifier: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function findUserByIdentifier(identifier: string) {
  const user = await prisma.user.findUnique({ where: { email: identifier } });
  if (user) return user;

  return prisma.user.findFirst({
    where: { mobile: identifier, countryCode: '+91' },
  });
}

export async function signup(data: SignupData): Promise<{
  user: {
    id: string;
    fullName: string;
    email: string;
    mobile: string | null;
    countryCode: string;
    role: Role;
    emailVerified: boolean;
    isActive: boolean;
  };
  requiresEmailVerification: boolean;
}> {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    throw { statusCode: 409, message: 'Email already registered', isOperational: true };
  }

  if (data.mobile) {
    const existingMobile = await prisma.user.findFirst({
      where: { mobile: data.mobile, countryCode: data.countryCode },
    });
    if (existingMobile) {
      throw { statusCode: 409, message: 'Mobile number already registered', isOperational: true };
    }
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      mobile: data.mobile || null,
      countryCode: data.countryCode,
      passwordHash,
      role: data.role,
    },
  });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      countryCode: user.countryCode,
      role: user.role,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    },
    requiresEmailVerification: false,
  };
}

async function createSession(userId: string, refreshToken: string): Promise<void> {
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const expiresAt = new Date(Date.now() + parseExpiration(refreshExpiresIn));

  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt,
    },
  });
}

export async function loginWithPassword(
  data: LoginPasswordData,
): Promise<AuthTokens> {
  const user = await findUserByIdentifier(data.identifier);

  if (!user) {
    throw { statusCode: 401, message: 'Invalid credentials', isOperational: true };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / (1000 * 60));
    throw {
      statusCode: 423,
      message: `Account locked. Try again in ${remainingMin} minutes.`,
      isOperational: true,
    };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null, failedAttempts: 0 },
    });
  }

  if (!user.passwordHash) {
    throw { statusCode: 401, message: 'Invalid credentials', isOperational: true };
  }

  const isValid = await comparePassword(data.password, user.passwordHash);

  if (!isValid) {
    const newFailed = user.failedAttempts + 1;

    if (newFailed >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: newFailed, lockedUntil },
      });
      throw {
        statusCode: 423,
        message: `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`,
        isOperational: true,
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: newFailed },
    });

    throw { statusCode: 401, message: 'Invalid credentials', isOperational: true };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const tokens = generateTokenPair({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  await createSession(user.id, tokens.refreshToken);

  return tokens;
}

export async function requestOtp(
  data: LoginOtpRequestData,
): Promise<{ success: boolean; message: string; code?: string }> {
  const user = await findUserByIdentifier(data.identifier);

  if (!user) {
    return {
      success: true,
      message: 'If the identifier exists, an OTP has been sent.',
    };
  }

  const channel = data.channel === 'email' ? OtpChannel.EMAIL : OtpChannel.SMS;
  return storeOtp(data.identifier, channel);
}

export async function verifyOtpAndLogin(
  data: LoginOtpVerifyData,
): Promise<AuthTokens> {
  const otpResult = await verifyOtp(data.identifier, data.code);

  if (!otpResult.success) {
    throw { statusCode: 401, message: otpResult.message, isOperational: true };
  }

  const user = await findUserByIdentifier(data.identifier);

  if (!user || !user.isActive) {
    throw { statusCode: 401, message: 'Invalid OTP or user not found', isOperational: true };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const tokens = generateTokenPair({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  await createSession(user.id, tokens.refreshToken);

  return tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.session.updateMany({
    where: { refreshToken },
    data: { revoked: true },
  });
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshToken },
  });

  if (!session || session.revoked || session.expiresAt < new Date()) {
    throw { statusCode: 401, message: 'Invalid or expired session', isOperational: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
  });

  if (!user || !user.isActive) {
    throw { statusCode: 401, message: 'User not found or inactive', isOperational: true };
  }

  await prisma.session.update({
    where: { refreshToken },
    data: { revoked: true },
  });

  const newTokens = generateTokenPair({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  await createSession(user.id, newTokens.refreshToken);

  return newTokens;
}

function parseExpiration(exp: string): number {
  const match = exp.match(/(\d+)([smhd])/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
