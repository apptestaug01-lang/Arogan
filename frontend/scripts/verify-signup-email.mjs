const uniqueEmail = `test.e2e.${Date.now()}@example.com`;

const payload = {
  fullName: 'E2E Test User',
  email: uniqueEmail,
  mobile: '9876543210',
  countryCode: '+91',
  password: 'Test@1234',
  confirmPassword: 'Test@1234',
  role: 'BORROWER',
};

(async () => {
  try {
    const res = await fetch('https://loanflow-backend.onrender.com/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log(`\nSignup succeeded for ${uniqueEmail}`);
      console.log('Now check:');
      console.log('1. Brevo dashboard -> Transactional -> Email logs for welcome email');
      console.log('2. Render backend logs for "Email sent via Brevo SMTP"');
    } else {
      console.log('Signup failed');
    }
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
