// Discovery probe used to write docs/01-discovery.md. Not part of the test suite.
// Phase A: validation probes. Every non-GET request is recorded and ABORTED, so no account is created.
// Phase B: one real signup per language, request/response recorded with secrets redacted.
// Usage: node scripts/discovery.mjs [validation|signup|all]
import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const BASE = process.env.BASE_URL ?? 'https://app.qa.nesto.ca';
const mode = process.argv[2] ?? 'all';
const PATHS = { en: '/signup', fr: '/fr/signup' };
const password = `Qa${randomBytes(6).toString('hex')}Z9`; // 16 chars, never printed

const uniqueEmail = (tag) => `qa.auto.${tag}.${Date.now()}${randomBytes(2).toString('hex')}@${process.env.EMAIL_DOMAIN ?? 'mailinator.com'}`;
const baseline = (tag) => ({
  firstName: 'Quality',
  lastName: 'Tester',
  phone: '5145550123',
  email: uniqueEmail(tag),
  password,
  passwordConfirmation: password,
});

const SECRET_KEY = /pass|token|secret|authorization|cookie|jwt|session/i;
const redact = (v, k = '') => {
  if (v === null || typeof v !== 'object') return SECRET_KEY.test(k) && v ? '[REDACTED]' : v;
  if (Array.isArray(v)) return v.map((x) => redact(x, k));
  return Object.fromEntries(Object.entries(v).map(([key, val]) => [key, redact(val, key)]));
};
const parse = (s) => {
  try {
    return redact(JSON.parse(s));
  } catch {
    return s ? `[non-JSON, ${s.length} chars]` : null;
  }
};

async function fill(page, data) {
  // The form is a Next.js page: filling before hydration loses values. Wait, fill, then verify they stuck.
  await page.waitForLoadState('networkidle');
  let lastMismatch = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const [name, value] of Object.entries(data)) {
      await page.locator(`form [name="${name}"]`).fill(value);
    }
    const stuck = await page.evaluate((d) => {
      const digits = (x) => x.replace(/\D/g, '');
      return Object.entries(d)
        .filter(([n, v]) => {
          const actual = document.querySelector(`form [name="${n}"]`).value;
          return n === 'phone' ? digits(actual) !== digits(v) : actual !== v;
        })
        .map(([n]) => n);
    }, data);
    if (stuck.length === 0) return;
    lastMismatch = stuck;
    await page.waitForTimeout(500);
  }
  throw new Error(`form values did not stick after 3 attempts: ${lastMismatch.join(', ')}`);
}

async function readErrors(page) {
  return page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('form [aria-invalid="true"]')) {
      const id = el.getAttribute('aria-describedby');
      out[el.getAttribute('name') ?? el.id] = id ? document.getElementById(id)?.innerText : '(no message)';
    }
    const orphan = [...document.querySelectorAll('[id^="form-error-message"]')]
      .filter((e) => !document.querySelector(`[aria-describedby="${e.id}"]`))
      .map((e) => e.innerText);
    if (orphan.length) out._unlinked = orphan;
    const alerts = [...document.querySelectorAll('[role="alert"], [class*="oast"]')].map((e) => e.innerText).filter(Boolean);
    if (alerts.length) out._alerts = alerts;
    return out;
  });
}

const cases = [
  ['empty form', () => ({ firstName: '', lastName: '', phone: '', email: '', password: '', passwordConfirmation: '' })],
  ['firstName spaces only', (b) => ({ ...b, firstName: '   ' })],
  ['firstName digits', (b) => ({ ...b, firstName: '12345' })],
  ['lastName empty', (b) => ({ ...b, lastName: '' })],
  ['email no @', (b) => ({ ...b, email: 'plainaddress' })],
  ['email no TLD', (b) => ({ ...b, email: 'user@domain' })],
  ['email double @', (b) => ({ ...b, email: 'user@@example.com' })],
  ['email trailing space', (b) => ({ ...b, email: `${b.email} ` })],
  ['phone too short', (b) => ({ ...b, phone: '123' })],
  ['phone letters', (b) => ({ ...b, phone: 'abcdefghij' })],
  ['phone invalid NANP', (b) => ({ ...b, phone: '1234567890' })],
  ['phone formatted', (b) => ({ ...b, phone: '(514) 555-0123' })],
  ['password 11 chars', (b) => ({ ...b, password: 'Abcdefghi12', passwordConfirmation: 'Abcdefghi12' })],
  ['password no uppercase', (b) => ({ ...b, password: 'abcdefghij12', passwordConfirmation: 'abcdefghij12' })],
  ['password no lowercase', (b) => ({ ...b, password: 'ABCDEFGHIJ12', passwordConfirmation: 'ABCDEFGHIJ12' })],
  ['password no digit', (b) => ({ ...b, password: 'Abcdefghijkl', passwordConfirmation: 'Abcdefghijkl' })],
  ['password 33 chars', (b) => ({ ...b, password: `Aa1${'x'.repeat(30)}`, passwordConfirmation: `Aa1${'x'.repeat(30)}` })],
  ['password mismatch', (b) => ({ ...b, passwordConfirmation: `${b.password}x` })],
  ['confirmation empty', (b) => ({ ...b, passwordConfirmation: '' })],
  ['all valid, consent unchecked (aborted)', (b) => b],
];

async function validation(browser, lang) {
  const results = [];
  for (const [name, build] of cases) {
    const page = await browser.newPage();
    const blocked = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      if (req.method() === 'GET' || req.method() === 'OPTIONS') return route.continue();
      blocked.push({ method: req.method(), url: req.url(), body: parse(req.postData() ?? '') });
      return route.abort();
    });
    await page.goto(BASE + PATHS[lang]);
    await page.locator('form [name="firstName"]').waitFor();
    await fill(page, build(baseline('probe')));
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1200);
    results.push({ case: name, errors: await readErrors(page), blockedRequests: blocked });
    await page.close();
  }
  return results;
}

async function signup(browser, lang, { consent }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const traffic = [];
  page.on('response', async (res) => {
    const req = res.request();
    if (req.method() === 'GET' || req.method() === 'OPTIONS') return;
    let body = null;
    try {
      body = parse(await res.text());
    } catch {
      body = '[unreadable]';
    }
    traffic.push({
      method: req.method(),
      url: req.url(),
      status: res.status(),
      requestHeaders: Object.keys(req.headers()).sort(),
      requestBody: parse(req.postData() ?? ''),
      responseBody: body,
    });
  });
  await page.goto(BASE + PATHS[lang]);
  const data = baseline(lang);
  await fill(page, data);
  await page.locator('[data-testid="region-select"]').selectOption('QC');
  if (consent) await page.locator('label[for="leadDistributeConsentAgreement"]').click({ position: { x: 5, y: 5 } });
  const consentChecked = await page.locator('#leadDistributeConsentAgreement').isChecked();
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(8000);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/after-${lang}.png` });
  const after = {
    url: page.url(),
    title: await page.title(),
    heading: await page.locator('h1, h2').first().innerText().catch(() => null),
    errors: await readErrors(page).catch(() => ({})),
    cookieNames: (await context.cookies()).map((c) => c.name),
  };
  await context.close();
  return { submitted: { ...data, password: '[REDACTED]', passwordConfirmation: '[REDACTED]', province: 'QC', consentChecked }, traffic, after };
}

const browser = await chromium.launch();
const out = {};
for (const lang of ['en', 'fr']) {
  out[lang] = {};
  if (mode !== 'signup') out[lang].validation = await validation(browser, lang);
  if (mode !== 'validation') out[lang].signup = await signup(browser, lang, { consent: lang === 'en' });
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
