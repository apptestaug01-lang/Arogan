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
const email = 'apptestaug01@gmail.com';

(async () => {
  console.log(`Running in ${env} mode`);
  console.log(`API: ${config.apiBase}\n`);

  try {
    const res = await fetch(`${config.apiBase}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text.slice(0, 500));
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
