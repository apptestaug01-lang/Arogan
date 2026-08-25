const apiBase = 'https://arogan-mx0n.onrender.com/api';
const email = 'apptestaug01@gmail.com';

(async () => {
  try {
    const forgotRes = await fetch(`${apiBase}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    console.log('Forgot password status:', forgotRes.status);
    console.log('Forgot password body:', await forgotRes.text());

    console.log('\nNow check:');
    console.log('1. Render backend logs for reset token in DB');
      console.log('2. Brevo email logs for the reset email');
    console.log('3. The token in the email link');
    console.log('4. Try resetting within 30 minutes');
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
