const BASE = 'https://arogan-mx0n.onrender.com/api';
const email = `smoke_${Date.now()}@example.com`;
const password = 'SmokeTest#1234';

const signup = await fetch(`${BASE}/auth/signup`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fullName:'S', email, countryCode:'+91', mobile:`98${Date.now().toString().slice(-8)}`, password, confirmPassword:password, role:'BORROWER' }) });
const login = await fetch(`${BASE}/auth/login/password`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ identifier:email, password }) });
const token = (await login.json()).data.accessToken;
const auth = { Authorization:`Bearer ${token}` };
const presign = await fetch(`${BASE}/documents/presign`, { method:'POST', headers:{'Content-Type':'application/json', ...auth}, body: JSON.stringify({ applicationId:'LAP-2026-0184', category:'KYC', fileName:'aadhar.pdf', contentType:'application/pdf', contentLength:27 }) });
const { documentId, uploadUrl } = (await presign.json()).data;
console.log('URL:', uploadUrl);

import { execFileSync } from 'node:child_process';
const body = 'smoke test content here!!';
try {
  const out = execFileSync('curl.exe', ['-s','--max-time','25','-X','PUT','--data-binary', body, '-H','Content-Type: application/pdf', uploadUrl], { encoding:'utf8' });
  console.log('curl PUT status printed via -w below');
} catch (e) {
  console.log('curl stderr:', e.stderr?.toString().slice(0,200));
  console.log('curl stdout:', e.stdout?.toString().slice(0,200));
}
// also report status with -w
try {
  const w = execFileSync('curl.exe', ['-s','--max-time','25','-o','NUL','-w','%{http_code}','-X','PUT','--data-binary', body, '-H','Content-Type: application/pdf', uploadUrl], { encoding:'utf8' });
  console.log('curl PUT http code:', w);
} catch (e) { console.log('code err', e.message); }
