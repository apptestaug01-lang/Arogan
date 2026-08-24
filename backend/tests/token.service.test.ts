describe('token service', () => {
  const { generateTokenPair, generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../src/services/token.service.js');
  const jwt = require('jsonwebtoken');

  const testPayload = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'BORROWER',
  };

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-only-32chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only-32chars';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(testPayload);
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.jti).toBeUndefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token with jti', () => {
      const token = generateRefreshToken(testPayload);
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.jti).toBeDefined();
    });

    it('should generate tokens with different jti values', () => {
      const token1 = generateRefreshToken(testPayload);
      const token2 = generateRefreshToken(testPayload);
      const decoded1 = jwt.verify(token1, process.env.JWT_REFRESH_SECRET);
      const decoded2 = jwt.verify(token2, process.env.JWT_REFRESH_SECRET);
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
  });

  describe('generateTokenPair', () => {
    it('should return both access and refresh tokens', () => {
      const pair = generateTokenPair(testPayload);
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should throw for invalid access token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.jti).toBeDefined();
    });

    it('should throw for invalid refresh token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow();
    });
  });
});
