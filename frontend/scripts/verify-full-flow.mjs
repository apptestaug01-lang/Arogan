const env = process.env.E2E_ENV || 'local';

const configs = {
  local: {
    apiBase: 'http://localhost:4000/api',
  },
  render: {
    apiBase: 'https://arogan-mx0n.onrender.com/api',
  },
};

const config = configs[env] || configs.local;
const uniqueEmail = `apptestaug01+${Date.now()}@gmail.com`;

const payload = {
  fullName: 'Test User',
  email: uniqueEmail,
  mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
  countryCode: '+91',
  password: 'Cursorai!@2026',
  confirmPassword: 'Cursorai!@2026',
  role: 'BORROWER',
};

(async () => {
  console.log(`Running in ${env} mode`);
  console.log(`API: ${config.apiBase}\n`);

  try {
    const signupRes = await fetch(`${config.apiBase}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const signupText = await signupRes.text();
    console.log('Signup Status:', signupRes.status);
    console.log('Signup Body:', signupText.slice(0, 300));

    if (signupRes.ok) {
      const forgotRes = await fetch(`${config.apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail }),
      });

      const forgotText = await forgotRes.text();
      console.log('\nForgot Password Status:', forgotRes.status);
      console.log('Forgot Password Body:', forgotText.slice(0, 300));
      console.log(`\nCheck Gmail for: ${uniqueEmail}`);
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
