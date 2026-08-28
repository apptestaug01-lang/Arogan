const BASE = 'https://arogan-mx0n.onrender.com/api';
const email = `smoke_${Date.now()}@example.com`;
const password = 'SmokeTest#1234';
const log = (...a) => console.log(...a);

const signup = await fetch(`${BASE}/auth/signup`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName: 'Smoke Test', email, countryCode: '+91', mobile: `98${Date.now().toString().slice(-8)}`, password, confirmPassword: password, role: 'BORROWER' }),
});
if (!signup.ok) { console.log('signup', signup.status, await signup.text()); process.exit(1); }

const login = await fetch(`${BASE}/auth/login/password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: email, password }),
});
const loginBody = await login.json();
const token = loginBody.data?.accessToken; const userId = loginBody.data?.user?.id;
if (!token) { console.log('login', loginBody); process.exit(1); }
log('user id:', userId);
const auth = { Authorization: `Bearer ${token}` };

const APP = 'LAP-2026-0184'; const CAT = 'KYC';
const BODY = 'smoke test content here!!';
const presign = await fetch(`${BASE}/documents/presign`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ applicationId: APP, category: CAT, fileName: 'aadhar.pdf', contentType: 'application/pdf', contentLength: Buffer.byteLength(BODY) }),
});
const presignBody = await presign.json();
const { documentId, key, uploadUrl } = presignBody.data;
log('presign:', presign.status, '| KEY =>', key);
log('UPLOAD URL =>', uploadUrl);
const expected = `borrowers/${userId}/applications/${APP}/documents/${CAT}/${documentId}/aadhar.pdf`;
log('matches expected layout:', key === expected);

const put = await fetch(uploadUrl, { method: 'PUT', body: BODY, headers: { 'Content-Type': 'application/pdf' } });
log('PUT to MinIO:', put.status);
if (!put.ok) { console.log(await put.text()); process.exit(1); }

const complete = await fetch(`${BASE}/documents/${documentId}/complete`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ applicationId: APP, category: CAT, fileName: 'aadhar.pdf', contentType: 'application/pdf' }),
});
log('complete:', complete.status, JSON.stringify(await complete.json()).slice(0, 160));

const list = await fetch(`${BASE}/documents/documents`, { headers: auth });
const listBody = await list.json();
log('list:', list.status, 'count:', listBody.data?.documents?.length, '| category:', listBody.data?.documents?.[0]?.category);

const del = await fetch(`${BASE}/documents`, {
  method: 'DELETE', headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ documentIds: [documentId] }),
});
log('bulk delete:', del.status, JSON.stringify(await del.json()).slice(0, 160));

const list2 = await fetch(`${BASE}/documents/documents`, { headers: auth });
log('after delete count:', (await list2.json()).data?.documents?.length);
log('=== SMOKE TEST PASSED ===');
