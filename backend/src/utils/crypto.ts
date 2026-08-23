import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { randomInt } from 'crypto';

export async function hashPassword(
  password: string,
  costFactor?: number,
): Promise<string> {
  const cost = costFactor || Number(process.env.BCRYPT_COST) || 12;
  return bcrypt.hash(password, cost);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateOtp(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return randomInt(min, max + 1).toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function compareOtp(otp: string, hash: string): boolean {
  return hashOtp(otp) === hash;
}

export function generateSecureToken(): string {
  return crypto.randomUUID();
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
