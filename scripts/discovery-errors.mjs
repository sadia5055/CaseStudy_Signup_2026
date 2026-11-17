// Discovery probe: what does the UI do when the backend rejects the signup? Not part of the test suite.
// Usage: DUP_EMAIL=<already-registered throwaway> SHOT_DIR=<dir> node scripts/discovery-errors.mjs
import { chromium } from '@playwright/test';
import { randomBytes } from 'node:crypto';

const BASE = process.env.BASE_URL ?? 'https://app.qa.nesto.ca';
const password = `Qa${randomBytes(6).toString('hex')}Z9`;
const scenarios = [
  { name: 'placeholder-domain', email: `qa.auto.err.${Date.now()}@example.com` },
  ...(process.env.DUP_EMAIL ? [{ name: 'duplicate-email', email: process.env.DUP_EMAIL }] : []),
];

const browser = await chromium.launch();
const out = [];
for (const lang of ['en', 'fr']) {
  for (const sc of scenarios) {
    const page = await browser.newPage();
    const calls = [];
    page.on('response', async (res) => {
      if (res.request().method() !== 'POST' || !res.url().includes('/api/accounts')) return;
      let body;
      try { body = await res.json(); } catch { body = '[non-JSON]'; }
      calls.push({ status: res.status(), body: JSON.stringify(body).slice(0, 300) });
    });
    await page.goto(`${BASE}${lang === 'fr' ? '/fr' : ''}/signup`);
    await page.waitForLoadState('networkidle');
    const f = (n, v) => page.locator(`form [name="${n}"]`).fill(v);
    await f('firstName', 'Quality'); await f('lastName', 'Tester'); await f('phone', '5145550123');
    await f('email', sc.email); await f('password', password); await f('passwordConfirmation', password);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    const visible = await page.evaluate(() => {
      const sel = '[role="alert"],[role="status"],[class*="oast"],[class*="lert"],[class*="rror"],[aria-invalid="true"]';
      return [...document.querySelectorAll(sel)].map((e) => (e.innerText || e.getAttribute('name') || '').trim()).filter(Boolean);
    });
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/err-${sc.name}-${lang}.png` });
    out.push({ lang, scenario: sc.name, calls, url: page.url(), visible: [...new Set(visible)] });
    await page.close();
  }
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
