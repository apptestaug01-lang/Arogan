describe('validation schemas', () => {
  const { signupSchema, loginPasswordSchema, otpRequestSchema, otpVerifySchema, refreshSchema } = require('../src/utils/validation.js');

  describe('signupSchema', () => {
    const validSignup = {
      fullName: 'John Doe',
      email: 'john@example.com',
      mobile: '9876543210',
      countryCode: '+91',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      role: 'BORROWER',
    };

    it('should pass for valid input', () => {
      expect(signupSchema.safeParse(validSignup).success).toBe(true);
    });

    it('should reject short full name', () => {
      const result = signupSchema.safeParse({ ...validSignup, fullName: 'J' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = signupSchema.safeParse({ ...validSignup, email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('should reject mobile not starting with 6-9', () => {
      const result = signupSchema.safeParse({ ...validSignup, mobile: '1234567890' });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = signupSchema.safeParse({ ...validSignup, password: 'short', confirmPassword: 'short' });
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = signupSchema.safeParse({ ...validSignup, password: 'nouppercase1!', confirmPassword: 'nouppercase1!' });
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = signupSchema.safeParse({ ...validSignup, password: 'NOLOWERCASE1!', confirmPassword: 'NOLOWERCASE1!' });
      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = signupSchema.safeParse({ ...validSignup, password: 'NoNumber!', confirmPassword: 'NoNumber!' });
      expect(result.success).toBe(false);
    });

    it('should reject password without special character', () => {
      const result = signupSchema.safeParse({ ...validSignup, password: 'NoSpecial1', confirmPassword: 'NoSpecial1' });
      expect(result.success).toBe(false);
    });

    it('should reject mismatched passwords', () => {
      const result = signupSchema.safeParse({ ...validSignup, confirmPassword: 'Different!1' });
      expect(result.success).toBe(false);
    });

    it('should accept empty mobile (optional)', () => {
      const result = signupSchema.safeParse({ ...validSignup, mobile: '' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const result = signupSchema.safeParse({ ...validSignup, role: 'SUPERUSER' });
      expect(result.success).toBe(false);
    });
  });

  describe('loginPasswordSchema', () => {
    it('should pass for valid input', () => {
      const data = { identifier: 'john@example.com', password: 'password123' };
      expect(loginPasswordSchema.safeParse(data).success).toBe(true);
    });

    it('should reject empty identifier', () => {
      const data = { identifier: '', password: 'password123' };
      expect(loginPasswordSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('otpRequestSchema', () => {
    it('should pass for valid email input', () => {
      const data = { identifier: 'john@example.com', channel: 'email' };
      expect(otpRequestSchema.safeParse(data).success).toBe(true);
    });

    it('should reject invalid channel', () => {
      const data = { identifier: 'john@example.com', channel: 'push' };
      expect(otpRequestSchema.safeParse(data).success).toBe(false);
    });
  });

  describe('otpVerifySchema', () => {
    it('should pass for valid 6-digit code', () => {
      const data = { identifier: 'john@example.com', code: '123456' };
      expect(otpVerifySchema.safeParse(data).success).toBe(true);
    });

    it('should reject 5-digit code', () => {
      const data = { identifier: 'john@example.com', code: '12345' };
      expect(otpVerifySchema.safeParse(data).success).toBe(false);
    });
  });

  describe('refreshSchema', () => {
    it('should pass for valid input', () => {
      const data = { refreshToken: 'some-refresh-token' };
      expect(refreshSchema.safeParse(data).success).toBe(true);
    });

    it('should reject empty refresh token', () => {
      const data = { refreshToken: '' };
      expect(refreshSchema.safeParse(data).success).toBe(false);
    });
  });
});
