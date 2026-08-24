function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderOtpTemplate(fullName: string, code: string, expirySeconds: number = 60): string {
  const safeName = escapeHtml(fullName || 'there');
  const expiryMinutes = Math.ceil(expirySeconds / 60);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LoanFlow Verification Code</title>
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .logo-text { color: white; font-weight: bold; font-size: 20px; }
    .code-box { background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; letter-spacing: 3px; }
    .code { font-size: 36px; font-weight: 700; color: #1e3a8a; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span class="logo-text">L</span></div>
      <h1 style="font-size: 24px; margin: 16px 0 0 0;">LoanFlow Verification</h1>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="font-size: 16px; line-height: 1.6;">Your verification code is:</p>
    <div class="code-box">
      <span class="code">${code}</span>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">This code expires in ${expiryMinutes} minutes. If you did not request this code, please ignore this email.</p>
    <div class="footer">
      <p>LoanFlow • Enterprise Loan Platform</p>
      <p>If you have any questions, contact support@loanflow.app</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderWelcomeTemplate(fullName: string): string {
  const safeName = escapeHtml(fullName || 'there');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to LoanFlow</title>
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .logo-text { color: white; font-weight: bold; font-size: 20px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .features { display: flex; flex-direction: column; gap: 16px; margin: 24px 0; }
    .feature-item { display: flex; align-items: flex-start; gap: 12px; }
    .feature-icon { width: 24px; height: 24px; background: #eff6ff; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span class="logo-text">L</span></div>
      <h1 style="font-size: 24px; margin: 16px 0 0 0;">Welcome to LoanFlow!</h1>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="font-size: 16px; line-height: 1.6;">Thank you for signing up. Your account has been created successfully.</p>
    <div class="features">
      <div class="feature-item">
        <div class="feature-icon">✓</div>
        <div><strong style="display: block;">Secure authentication</strong><span style="font-size: 14px; color: #6b7280;">Bank-level security with OTP and password protection</span></div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">✓</div>
        <div><strong style="display: block;">Real-time loan processing</strong><span style="font-size: 14px; color: #6b7280;">Apply and track your loan applications instantly</span></div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">✓</div>
        <div><strong style="display: block;">Role-based dashboards</strong><span style="font-size: 14px; color: #6b7280;">Custom views for borrowers, analysts, and approvers</span></div>
      </div>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="button">Go to Your Dashboard</a>
    </div>
    <div class="footer">
      <p>LoanFlow • Enterprise Loan Platform</p>
      <p>Need help? Contact support@loanflow.app</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderPasswordResetTemplate(fullName: string, resetUrl: string): string {
  const safeName = escapeHtml(fullName || 'there');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Instructions</title>
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .logo-text { color: white; font-weight: bold; font-size: 20px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 24px 0; font-size: 14px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span class="logo-text">L</span></div>
      <h1 style="font-size: 24px; margin: 16px 0 0 0;">Password Reset Request</h1>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="font-size: 16px; line-height: 1.6;">You (or someone else) has requested a password reset for your LoanFlow account. Click the button below to reset your password:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" class="button">Reset My Password</a>
    </div>
    <div class="warning">
      <strong style="display: block; margin-bottom: 8px;">Important:</strong>
      This link will expire in 30 minutes. If you did not request this password reset, please ignore this email and your password will remain unchanged.
    </div>
    <div class="footer">
      <p>LoanFlow • Enterprise Loan Platform</p>
      <p>If you have questions, contact support@loanflow.app</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderLoginNotificationTemplate(fullName: string, ip: string, userAgent: string, timestamp: string): string {
  const safeName = escapeHtml(fullName || 'there');
  const safeIp = escapeHtml(ip || 'unknown');
  const safeUserAgent = escapeHtml(userAgent || 'unknown');
  const safeTimestamp = escapeHtml(timestamp);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Login to LoanFlow</title>
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .logo-text { color: white; font-weight: bold; font-size: 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .info-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .info-table td:first-child { font-weight: 600; color: #374151; width: 30%; }
    .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; font-size: 14px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span class="logo-text">L</span></div>
      <h1 style="font-size: 24px; margin: 16px 0 0 0;">New Login Detected</h1>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="font-size: 16px; line-height: 1.6;">A new login to your LoanFlow account was detected:</p>
    <table class="info-table">
      <tr><td>Time:</td><td>${safeTimestamp}</td></tr>
      <tr><td>IP Address:</td><td>${safeIp}</td></tr>
      <tr><td>Device:</td><td>${safeUserAgent}</td></tr>
    </table>
    <div class="warning">
      If this was you, no action is needed. If this was not you, please reset your password immediately.
    </div>
    <div class="footer">
      <p>LoanFlow • Enterprise Loan Platform</p>
      <p>If you have questions, contact support@loanflow.app</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderPasswordChangedTemplate(fullName: string): string {
  const safeName = escapeHtml(fullName || 'there');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed Successfully</title>
  <style>
    body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .logo-text { color: white; font-weight: bold; font-size: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo"><span class="logo-text">L</span></div>
      <h1 style="font-size: 24px; margin: 16px 0 0 0;">Password Changed</h1>
    </div>
    <p style="font-size: 16px; line-height: 1.6;">Hi ${safeName},</p>
    <p style="font-size: 16px; line-height: 1.6;">Your LoanFlow password has been changed successfully. If you did not make this change, please contact support immediately.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Back to Login</a>
    </div>
    <div class="footer">
      <p>LoanFlow • Enterprise Loan Platform</p>
      <p>Need immediate help? Contact support@loanflow.app</p>
    </div>
  </div>
</body>
</html>`;
}

export function validateAllTemplates(): void {
  const testVars = { fullName: 'Test User', code: '123456', expirySeconds: 60, resetUrl: 'http://localhost:5173/reset-password?token=test' };
  try {
    renderOtpTemplate(testVars.fullName, testVars.code, testVars.expirySeconds);
    renderWelcomeTemplate(testVars.fullName);
    renderPasswordResetTemplate(testVars.fullName, testVars.resetUrl);
    renderLoginNotificationTemplate(testVars.fullName, '127.0.0.1', 'TestAgent/1.0', new Date().toISOString());
    renderPasswordChangedTemplate(testVars.fullName);
  } catch (err) {
    throw new Error(`Template validation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
