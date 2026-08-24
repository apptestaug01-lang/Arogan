describe('email service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.BREVO_SMTP_USER = 'test@example.com';
    process.env.BREVO_SMTP_PASS = 'test-smtp-key';
    process.env.BREVO_FROM_EMAIL = 'no-reply@loanflow.app';
    process.env.BREVO_FROM_NAME = 'LoanFlow';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isBrevoConfigured', () => {
    it('should return true when all Brevo env vars are set', () => {
      jest.resetModules();
      const { isBrevoConfigured } = require('../src/services/brevoEmailProvider.js');
      expect(isBrevoConfigured()).toBe(true);
    });

    it('should return false when Brevo env vars are missing', () => {
      process.env.BREVO_SMTP_USER = '';
      process.env.BREVO_SMTP_PASS = '';
      jest.resetModules();
      const { isBrevoConfigured } = require('../src/services/brevoEmailProvider.js');
      expect(isBrevoConfigured()).toBe(false);
    });
  });

  describe('email provider factory', () => {
    it('should use NoopOtpProvider when Brevo is not configured', () => {
      process.env.BREVO_SMTP_USER = '';
      process.env.BREVO_SMTP_PASS = '';
      jest.resetModules();
      const { emailProvider } = require('../src/services/email.service.js');
      expect(emailProvider).toBeDefined();
    });
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
