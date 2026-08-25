const env = process.env.E2E_ENV || 'local';

const configs = {
  local: {
    apiBase: 'http://localhost:4000/api',
    frontendUrl: 'http://localhost:5173',
  },
  render: {
    apiBase: 'https://loanflow-backend.onrender.com/api',
    frontendUrl: 'https://loanflow-frontend.onrender.com',
  },
};

const config = configs[env] || configs.local;
const uniqueEmail = 'apptestaug01@gmail.com';
const uniqueMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

const payload = {
  fullName: 'Test User',
  email: uniqueEmail,
  mobile: uniqueMobile,
  countryCode: '+91',
  password: 'Cursorai!@2026',
  confirmPassword: 'Cursorai!@2026',
  role: 'BORROWER',
};

(async () => {
  console.log(`Running in ${env} mode`);
  console.log(`API: ${config.apiBase}`);
  console.log(`Frontend: ${config.frontendUrl}\n`);

  try {
    const res = await fetch(`${config.apiBase}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text.slice(0, 500));

    if (res.ok) {
      console.log(`\nSignup succeeded for ${uniqueEmail}`);
      console.log('Now check:');
      console.log('1. Backend logs for "Email sent via Brevo SMTP"');
      console.log('2. Gmail inbox for welcome email');
    } else {
      console.log('Signup failed');
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
