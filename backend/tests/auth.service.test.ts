describe('auth service', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    oTPRequest: {
      count: jest.fn(),
      create: jest.fn(),
    },
  };

  jest.mock('../src/lib/prisma.js', () => ({
    prisma: mockPrisma,
  }));

  jest.mock('../src/services/otp.service.js', () => ({
    storeOtp: jest.fn(),
    verifyOtp: jest.fn(),
  }));

  jest.mock('../src/utils/crypto.js', () => ({
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    generateOtp: jest.fn(),
    hashOtp: jest.fn(),
    compareOtp: jest.fn(),
    generateSecureToken: jest.fn(),
    generateRefreshToken: jest.fn(),
  }));

  jest.mock('../src/services/token.service.js', () => ({
    generateTokenPair: jest.fn(),
    verifyRefreshToken: jest.fn(),
  }));

  const { signup, loginWithPassword } = require('../src/services/auth.service.js');
  const { generateTokenPair } = require('../src/services/token.service.js');
  const { hashPassword, comparePassword } = require('../src/utils/crypto.js');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signup', () => {
    const validSignupData = {
      fullName: 'John Doe',
      email: 'john@example.com',
      mobile: '9876543210',
      countryCode: '+91',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      role: 'BORROWER',
    };

    it('should create a new user when no existing user found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      hashPassword.mockResolvedValue('hashed-password-123');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        fullName: 'John Doe',
        email: 'john@example.com',
        mobile: '9876543210',
        countryCode: '+91',
        passwordHash: 'hashed-password-123',
        role: 'BORROWER',
        emailVerified: false,
        isActive: true,
        lockedUntil: null,
        failedAttempts: 0,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await signup(validSignupData);

      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('john@example.com');
      expect(result.requiresEmailVerification).toBe(false);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw 409 for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user', email: 'john@example.com' });

      await expect(signup(validSignupData)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email already registered',
      });
    });

    it('should throw 409 for duplicate mobile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing-user', mobile: '9876543210' });

      await expect(signup(validSignupData)).rejects.toMatchObject({
        statusCode: 409,
        message: 'Mobile number already registered',
      });
    });

    it('should reject non-BORROWER role', async () => {
      await expect(
        signup({ ...validSignupData, role: 'ADMIN' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('loginWithPassword', () => {
    const mockUser = {
      id: 'user-1',
      email: 'john@example.com',
      fullName: 'John Doe',
      role: 'BORROWER',
      lockedUntil: null,
      failedAttempts: 0,
      isActive: true,
      passwordHash: 'hashed-password',
    };

    it('should throw 401 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        loginWithPassword({ identifier: 'john@example.com', password: 'Str0ng!Pass' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
    });

    it('should throw 423 for locked account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 999999),
        failedAttempts: 5,
      });

      await expect(
        loginWithPassword({ identifier: 'john@example.com', password: 'Str0ng!Pass' }),
      ).rejects.toMatchObject({ statusCode: 423 });
    });

    it('should throw 401 for invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);

      await expect(
        loginWithPassword({ identifier: 'john@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });
    });

    it('should return tokens on successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      generateTokenPair.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      mockPrisma.session.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      const result = await loginWithPassword({
        identifier: 'john@example.com',
        password: 'Str0ng!Pass',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');
      expect(mockPrisma.session.create).toHaveBeenCalledTimes(1);
    });

    it('should throw 423 after 5 failed attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedAttempts: 4,
      });
      comparePassword.mockResolvedValue(false);

      const MAX_FAILED = 5;
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        failedAttempts: MAX_FAILED - 1,
      });

      await expect(
        loginWithPassword({ identifier: 'john@example.com', password: 'wrong' }),
      ).rejects.toMatchObject({ statusCode: 423 });
    });
  });
});
