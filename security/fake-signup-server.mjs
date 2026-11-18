// A tiny local stand-in for the signup page, used only by `npm run test:security`.
// It mimics what the page object relies on (labels, unique ids, a ready marker, the geolocation call and
// POST /api/accounts) so the real fixtures and helpers can be exercised with canary credentials
// without touching the QA environment. It never logs request bodies.
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_PORT ?? 4783);
const TOKEN = process.env.CANARY_TOKEN ?? 'token-not-set';
const modeOf = (req) => String(req.headers['x-fake-mode'] ?? 'ok');

const page = (mode) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>nesto | Signup</title></head>
<body><div id="__next"><main>
<h1>Create a nesto account</h1>
<form id="f" novalidate>
<label for="field-2">First name</label><input id="field-2" name="firstName" type="text">
<label for="field-4">Last name</label><input id="field-4" name="lastName" type="text">
<select name="phoneCountry"><option value="CA" selected>Canada</option><option value="US">United States</option></select>
<label for="field-6">Phone number</label><input id="field-6" name="phone" type="tel">
<label for="field-8">Province of purchase</label><select id="field-8" name="region"><option value="">Province</option><option value="ON" selected>Ontario</option><option value="QC">Quebec</option></select>
<label for="field-10">Email</label><input id="field-10" name="email" type="text">
<label for="field-12">Password</label><input id="field-12" name="password" type="password">
<label for="field-14">Confirm password</label><input id="field-14" name="passwordConfirmation" type="password">
<input id="consent" name="leadDistributeConsentAgreement" type="checkbox">
<label for="consent">By checking this box, you agree to be contacted by nesto’s partners for the purposes of offering you financial products.</label>
<button type="submit">Create your account</button>
</form></main></div>
<script>
  // ready marker the page object waits for, and the geolocation call it listens for
  document.getElementById('__next')['__reactContainer$fake'] = {};
  fetch('/api/geolocation/all').catch(() => {});
  ${
    mode === 'sticky-clear'
      ? `// this mode empties the email and password fields right after they are set, so the value is never kept
  document.addEventListener('input', (e) => { const t = e.target; if (t.type === 'password' || t.name === 'email') t.value = ''; });`
      : ''
  }
  document.getElementById('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => document.querySelector('[name="' + n + '"]');
    const body = { firstName: v('firstName').value, lastName: v('lastName').value, email: v('email').value.trim(),
      phone: '+1' + v('phone').value.replace(/\\D/g, ''), region: v('region').value, language: 'en',
      leadDistributeConsentAgreement: v('leadDistributeConsentAgreement').checked, password: v('password').value,
      passwordSpecified: true, anonymousAccountId: 'anon-' + Math.random().toString(16).slice(2), createdAt: 'LOGIN' };
    const res = await fetch('/api/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    // the real app signs the user in through Auth0 before it navigates, which takes far longer than this
    if (res.status === 201) setTimeout(() => { location.href = '/getaquote${mode === 'redirect-code' ? `?code=${TOKEN}&state=${TOKEN}` : ''}'; }, 800);
  });
</script></body></html>`;

const readBody = (req) =>
  new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (url.pathname === '/health') return json(200, { ok: true });
  if (url.pathname === '/signup') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page(modeOf(req)));
  }
  if (url.pathname === '/getaquote') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<title>quote</title><h1>Get a quote</h1>');
  }
  if (url.pathname === '/api/geolocation/all') return json(200, {});
  if (url.pathname === '/api/accounts' && req.method === 'POST') {
    const sent = JSON.parse((await readBody(req)) || '{}');
    const mode = modeOf(req);
    if (mode === 'echo-422')
      return json(422, {
        error: 'invalid parameters',
        parameters: [`${sent.email} is not allowed`, 'placeholder email detected'],
      });
    const now = new Date().toISOString();
    if (mode === 'bad-schema') {
      // 201 with a body that breaks the contract and carries the canary values in the wrong places
      return json(201, {
        account: {
          id: 'not-a-number',
          role: 'borrower',
          email: sent.email,
          phone: sent.email,
          preferredLanguage: TOKEN,
        },
        token: { accessToken: TOKEN, expires: 'not-a-date' },
      });
    }
    return json(201, {
      account: {
        id: 1234567,
        rid: `rid-${TOKEN}`,
        role: 'borrower',
        email: sent.email,
        identityId: sent.email,
        firstName: sent.firstName,
        lastName: sent.lastName,
        phone: sent.phone,
        preferredLanguage: sent.language,
        region: sent.region,
        leadDistributeConsentAgreement: sent.leadDistributeConsentAgreement,
        partner: 'nesto',
        disabled: false,
        deleted: false,
        created: now,
      },
      token: { accessToken: TOKEN, refreshToken: TOKEN, tokenType: 'Bearer', expires: now },
    });
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, '127.0.0.1');
