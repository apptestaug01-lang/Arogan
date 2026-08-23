import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export interface TokenPayload {
  id: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret: jwt.Secret = process.env.JWT_ACCESS_SECRET || '';
  const expiresIn: string = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function generateRefreshToken(payload: TokenPayload): string {
  const secret: jwt.Secret = process.env.JWT_REFRESH_SECRET || '';
  const expiresIn: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret: jwt.Secret = process.env.JWT_ACCESS_SECRET || '';
  return jwt.verify(token, secret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const secret: jwt.Secret = process.env.JWT_REFRESH_SECRET || '';
  return jwt.verify(token, secret) as TokenPayload;
}

export function generateTokenPair(payload: TokenPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
