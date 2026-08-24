import { generateOtp, hashOtp, compareOtp } from '../src/utils/crypto.js';

describe('crypto utils', () => {
  describe('generateOtp', () => {
    it('should generate a 6-digit OTP', () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate OTP of custom length', () => {
      const otp = generateOtp(4);
      expect(otp).toHaveLength(4);
      expect(otp).toMatch(/^\d{4}$/);
    });
  });

  describe('hashOtp and compareOtp', () => {
    it('should hash and verify OTP correctly', () => {
      const otp = '123456';
      const hash = hashOtp(otp);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(otp);
      expect(compareOtp(otp, hash)).toBe(true);
    });

    it('should return false for wrong OTP', () => {
      const hash = hashOtp('123456');
      expect(compareOtp('654321', hash)).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    const { generateSecureToken, generateRefreshToken } = require('../src/utils/crypto.js');

    it('should generate a UUID', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('generateRefreshToken', () => {
    const { generateRefreshToken } = require('../src/utils/crypto.js');

    it('should generate a 64-character hex string', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate different tokens', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });
});

describe('password hashing', () => {
  const { hashPassword, comparePassword } = require('../src/utils/crypto.js');

  it('should hash a password', async () => {
    const hash = await hashPassword('TestPass123!', 4);
    expect(hash).toBeDefined();
    expect(hash).not.toBe('TestPass123!');
  });

  it('should produce different hashes for same password', async () => {
    const hash1 = await hashPassword('TestPass123!', 4);
    const hash2 = await hashPassword('TestPass123!', 4);
    expect(hash1).not.toBe(hash2);
  });

  it('should verify matching password', async () => {
    const hash = await hashPassword('TestPass123!', 4);
    const result = await comparePassword('TestPass123!', hash);
    expect(result).toBe(true);
  });

  it('should reject non-matching password', async () => {
    const hash = await hashPassword('TestPass123!', 4);
    const result = await comparePassword('WrongPass!', hash);
    expect(result).toBe(false);
  });
});
