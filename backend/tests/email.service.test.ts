describe('email service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.BREVO_API_KEY = 'test-api-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@loanflow.app';
    process.env.BREVO_FROM_NAME = 'LoanFlow';
    delete process.env.BREVO_SMS_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('isBrevoConfigured', () => {
    it('should return true when all Brevo env vars are set', () => {
      jest.resetModules();
      const { isBrevoConfigured } = require('../src/services/brevoEmailProvider.js');
      expect(isBrevoConfigured()).toBe(true);
    });

    it('should return false when Brevo env vars are missing', () => {
      process.env.BREVO_API_KEY = '';
      jest.resetModules();
      const { isBrevoConfigured } = require('../src/services/brevoEmailProvider.js');
      expect(isBrevoConfigured()).toBe(false);
    });
  });

  describe('email provider factory', () => {
    it('should use NoopOtpProvider when Brevo is not configured', () => {
      process.env.BREVO_API_KEY = '';
      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      expect(emailProvider).toBeDefined();
    });
  });

  describe('SMS provider', () => {
    it('should fall back to email when BREVO_SMS_ENABLED is not set and identifier is email', async () => {
      process.env.BREVO_API_KEY = 'test-api-key';
      process.env.BREVO_FROM_EMAIL = 'no-reply@loanflow.app';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ messageId: 'email-fallback-123' })),
      });
      global.fetch = mockFetch;

      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      const result = await emailProvider.sendSms('user@example.com', 'Your code is 123456');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email-fallback-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
        }),
      );
    }, 15000);

    it('should return failure when BREVO_SMS_ENABLED is not set and identifier is mobile', async () => {
      process.env.BREVO_API_KEY = 'test-api-key';
      process.env.BREVO_FROM_EMAIL = 'no-reply@loanflow.app';
      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      const result = await emailProvider.sendSms('+919876543210', 'Your code is 123456');
      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
    });

    it('should use Brevo SMS when BREVO_SMS_ENABLED=true', async () => {
      process.env.BREVO_SMS_ENABLED = 'true';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ messageId: 'sms-123' })),
      });
      global.fetch = mockFetch;

      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      const result = await emailProvider.sendSms('+919876543210', 'Your code is 123456');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sms-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/transactionalSMS/sms',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'api-key': 'test-api-key' }),
        }),
      );
    });

    it('should return failure when Brevo SMS API returns error', async () => {
      process.env.BREVO_SMS_ENABLED = 'true';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });
      global.fetch = mockFetch;

      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      await expect(emailProvider.sendSms('+919876543210', 'code')).rejects.toThrow('Brevo SMS API error 400');
    }, 15000);
  });

  describe('template rendering', () => {
    const {
      renderOtpTemplate,
      renderWelcomeTemplate,
      renderPasswordResetTemplate,
      renderLoginNotificationTemplate,
      renderPasswordChangedTemplate,
    } = require('../src/templates/emailTemplates.js');

    it('should render OTP template with code', () => {
      const html = renderOtpTemplate('John Doe', '123456');
      expect(html).toContain('123456');
      expect(html).toContain('John Doe');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('should render welcome template with name', () => {
      const html = renderWelcomeTemplate('Jane Smith');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('Welcome to LoanFlow');
    });

    it('should render password reset template with link', () => {
      const html = renderPasswordResetTemplate('John Doe', 'http://localhost:5173/reset-password?token=abc123');
      expect(html).toContain('John Doe');
      expect(html).toContain('abc123');
    });

    it('should render login notification template with IP and user agent', () => {
      const html = renderLoginNotificationTemplate('John Doe', '192.168.1.1', 'Mozilla/5.0', '2026-01-01T00:00:00Z');
      expect(html).toContain('John Doe');
      expect(html).toContain('192.168.1.1');
      expect(html).toContain('Mozilla/5.0');
    });

    it('should render password changed template with name', () => {
      const html = renderPasswordChangedTemplate('John Doe');
      expect(html).toContain('John Doe');
      expect(html).toContain('Password Changed');
    });

    it('should escape HTML in user input', () => {
      const html = renderOtpTemplate('<script>alert(1)</script>', '123456');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
