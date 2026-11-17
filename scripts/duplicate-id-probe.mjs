// Discovery probe: does the signup form pass through a state where several inputs share one id?
// Usage: node scripts/duplicate-id-probe.mjs <chromium|webkit|firefox> <en|fr> <real|stub> [loads]
// Measures at the moment the page object considers the page ready (geolocation answered + React
// owns the root) and again 1.5 s later. Not part of the test suite. Nothing is submitted.
import { chromium, firefox, webkit } from '@playwright/test';

const [engine = 'webkit', lang = 'fr', mode = 'real', loadsArg = '30'] = process.argv.slice(2);
const loads = Number(loadsArg);
const browserType = { chromium, firefox, webkit }[engine];
const stub = {
  'ipapi.co': { ip: '203.0.113.7', provider: 'ipapi.co', city: 'Example City', region: 'Ontario', region_code: 'ON', country: 'Canada', country_code: 'CA', latitude: 0, longitude: 0, postal: '', error: false },
  'ipinfo.io': { ip: '203.0.113.7', provider: 'ipinfo.io', city: 'Example City', region: 'Ontario', region_code: 'ON', country: 'CA', country_code: 'CA', latitude: 0, longitude: 0, postal: '', error: false },
};
const idsNow = (page) =>
  page.evaluate(() => [...document.querySelectorAll('form input')].map((e) => e.id).filter(Boolean));
const hasDuplicates = (ids) => new Set(ids).size < ids.length;

const browser = await browserType.launch();
let atReady = 0;
let later = 0;
let example = '';
for (let i = 0; i < loads; i++) {
  const page = await browser.newPage();
  if (mode === 'stub') {
    await page.route((u) => u.pathname === '/api/geolocation/all', (r) => r.fulfill({ json: stub }));
  }
  const geolocation = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/geolocation/all');
  await page.goto(`https://app.qa.nesto.ca${lang === 'fr' ? '/fr' : ''}/signup`);
  await geolocation;
  await page.waitForFunction(() => {
    const root = document.getElementById('__next');
    return root !== null && Object.keys(root).some((key) => key.startsWith('__reactContainer'));
  });
  const first = await idsNow(page);
  await page.waitForTimeout(1500);
  const second = await idsNow(page);
  if (hasDuplicates(first)) {
    atReady += 1;
    example ||= first.join(',');
  }
  if (hasDuplicates(second)) later += 1;
  await page.close();
}
await browser.close();
console.log(`${engine} ${lang} ${mode}: duplicate ids at ready ${atReady}/${loads}, 1.5 s later ${later}/${loads}`, example ? `e.g. [${example}]` : '');
