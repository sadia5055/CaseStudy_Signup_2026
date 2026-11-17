// `npm run test:security`: proves that canary credentials do not reach reports, logs or upload candidates.
//
//  1. scanner self-test: the scanner must find canaries hidden in plain, escaped, encoded and zipped forms
//  2. safe suite: passing and (deliberately) failing scenarios run through the real fixtures and helpers
//     with canary credentials; every output must be free of the canaries
//  3. leaky control: scenarios that leak on purpose must be DETECTED, otherwise the harness is broken
//  4. sanitized summary: built from both the safe and the (dirty) leaky results; must contain no canary
//
// Canary values are generated per run and never printed. Output lists only paths, labels and counts.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeNeedles, makeZip, scanTree } from './scan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = join(root, 'node_modules', '@playwright', 'test', 'cli.js');
const hex = (chars) => randomBytes(chars / 2).toString('hex');

const cores = { password: hex(24), email: hex(16), token: hex(24) };
const canary = {
  password: `Cnry-${cores.password}`,
  email: `canary-${cores.email}@canary.invalid`,
  token: `CANARYTOKEN${cores.token}`,
};
const needles = makeNeedles([
  { label: 'password', value: canary.password, core: cores.password },
  { label: 'email', value: canary.email, core: cores.email },
  { label: 'token', value: canary.token, core: cores.token },
]);

const work = mkdtempSync(join(tmpdir(), 'signup-security-'));
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

function runSuite(spec, outDir) {
  mkdirSync(outDir, { recursive: true });
  const run = spawnSync(process.execPath, [playwrightCli, 'test', '-c', 'security/playwright.config.ts'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      CI: '1',
      FORCE_COLOR: '0',
      CANARY_SPEC: spec,
      CANARY_OUT: outDir,
      CANARY_PASSWORD: canary.password,
      CANARY_EMAIL: canary.email,
      CANARY_TOKEN: canary.token,
    },
  });
  // The raw console output is kept so that it can be scanned like any other output. It is never printed here.
  writeFileSync(join(outDir, 'console.log'), `${run.stdout}\n${run.stderr}`);
  const results = JSON.parse(readFileSync(join(outDir, 'results.json'), 'utf8'));
  const outcomes = {};
  const walk = (s) => {
    for (const spec2 of s.specs ?? []) outcomes[spec2.title.split(' ')[0]] = spec2.tests[0].status;
    (s.suites ?? []).forEach(walk);
  };
  results.suites.forEach(walk);
  return outcomes;
}

const categoryOf = (file) =>
  file.endsWith('results.json')
    ? 'JSON report'
    : file.startsWith('report/')
      ? 'HTML report'
      : file.endsWith('console.log')
        ? 'console output'
        : file.endsWith('error-context.md')
          ? 'error-context.md'
          : file.includes('summary/')
            ? 'sanitized summary'
            : 'other file';

const summarize = (resultsPath, outDir) =>
  spawnSync(process.execPath, [join(root, 'scripts', 'summarize-results.mjs'), resultsPath, outDir], {
    encoding: 'utf8',
  });

try {
  console.log('\n[1/4] scanner self-test (it must find canaries hidden in every supported form)');
  {
    const dir = join(work, 'selftest');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plain.txt'), `x ${canary.password} y`);
    writeFileSync(join(dir, 'escaped.json'), JSON.stringify({ email: canary.email }));
    writeFileSync(join(dir, 'url.txt'), `?e=${encodeURIComponent(canary.email)}`);
    writeFileSync(
      join(dir, 'b64.json'),
      JSON.stringify({ blob: Buffer.from(`prefix ${canary.token} suffix`).toString('base64') }),
    );
    const inner = makeZip([{ name: 'inner.json', data: Buffer.from(JSON.stringify({ t: canary.token })) }], {
      deflate: true,
    });
    writeFileSync(join(dir, 'nested.zip'), makeZip([{ name: 'a.zip', data: inner }]));
    const report = makeZip(
      [{ name: 'report.json', data: Buffer.from(JSON.stringify({ title: `Fill "${canary.password}"` })) }],
      { deflate: true },
    );
    writeFileSync(
      join(dir, 'report.html'),
      `<html><template id="playwrightReportBase64">data:application/zip;base64,${report.toString('base64')}</template></html>`,
    );
    writeFileSync(join(dir, 'clean.txt'), 'nothing sensitive here');
    const { findings } = scanTree(dir, needles);
    const seen = new Set(findings.map((f) => `${f.file}:${f.label}`));
    for (const [file, label] of [
      ['plain.txt', 'password'],
      ['escaped.json', 'email'],
      ['url.txt', 'email'],
      ['b64.json', 'token'],
      ['nested.zip', 'token'],
      ['report.html', 'password'],
    ]) {
      check(`finds ${label} in ${file}`, seen.has(`${file}:${label}`));
    }
    check('reports nothing for a clean file', !findings.some((f) => f.file === 'clean.txt'));
  }

  console.log('\n[2/4] safe suite: real fixtures, page object and helpers with canary credentials');
  const safeDir = join(work, 'safe');
  const safe = runSuite('canary.spec.ts', safeDir);
  const expectedSafe = {
    C1: 'expected',
    C2: 'unexpected',
    C3: 'unexpected',
    C4: 'unexpected',
    C5: 'expected',
  };
  for (const [id, want] of Object.entries(expectedSafe)) {
    check(
      `${id} ${want === 'expected' ? 'passed' : 'failed'} as designed`,
      safe[id] === want,
      `got ${safe[id] ?? 'missing'}`,
    );
  }
  const safeScan = scanTree(safeDir, needles);
  const byCat = (scan) =>
    Object.entries(
      scan.findings.reduce(
        (acc, f) => ({
          ...acc,
          [`${categoryOf(f.file)} / ${f.label}`]: (acc[`${categoryOf(f.file)} / ${f.label}`] ?? 0) + f.count,
        }),
        {},
      ),
    );
  for (const [what, n] of byCat(safeScan)) console.log(`        LEAK  ${what}: ${n} occurrence(s)`);
  for (const f of safeScan.findings) console.log(`        in ${f.file}`);
  check(
    'no canary in HTML report, JSON report, console output, error-context.md or attachments',
    safeScan.findings.length === 0,
  );
  const contexts = [];
  const find = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) find(p);
      else if (n.endsWith('.md')) contexts.push(p);
    }
  };
  find(safeDir);
  check(
    'failing tests produced error-context files (the failure path was exercised)',
    contexts.length > 0,
    `${contexts.length} files`,
  );
  check(
    'no failure snapshot ("Page snapshot") in any error-context file',
    contexts.every((p) => !readFileSync(p, 'utf8').includes('# Page snapshot')),
  );
  const inv = safeScan.inventory;
  console.log(
    `        scanned ${inv.files} files (${inv.binarySkipped} images not text-scanned), ${inv.zipEntries} zip entries, ${inv.base64Strings} base64 strings`,
  );

  console.log('\n[3/4] leaky control: patterns that leak on purpose must be detected');
  const leakyDir = join(work, 'leaky');
  const leaky = runSuite('leaky-control.spec.ts', leakyDir);
  for (const [id, want] of Object.entries({ L1: 'expected', L2: 'unexpected', L3: 'expected' })) {
    check(
      `${id} ${want === 'expected' ? 'passed' : 'failed'} as designed`,
      leaky[id] === want,
      `got ${leaky[id] ?? 'missing'}`,
    );
  }
  const leakyScan = scanTree(leakyDir, needles);
  const cats = new Set(leakyScan.findings.map((f) => categoryOf(f.file)));
  for (const c of ['HTML report', 'JSON report', 'console output'])
    check(`scanner detects the leak in the ${c}`, cats.has(c));
  check(
    'scanner detects all three canary kinds across the leaky run',
    new Set(leakyScan.findings.map((f) => f.label)).size === 3,
  );

  console.log('\n[4/4] sanitized summary (files selected for upload)');
  for (const [name, dir] of [
    ['safe', safeDir],
    ['leaky (dirty input)', leakyDir],
  ]) {
    const out = join(work, `summary-${name.split(' ')[0]}`);
    const run = summarize(join(dir, 'results.json'), out);
    check(`summary builds from the ${name} results`, run.status === 0);
    const scan = scanTree(out, needles);
    check(
      `summary from the ${name} results contains no canary`,
      scan.findings.length === 0,
      `${scan.inventory.files} files scanned`,
    );
  }
} finally {
  if (failures.length === 0) rmSync(work, { recursive: true, force: true });
  else console.log(`\n  outputs kept for inspection (synthetic canaries only): ${work}`);
}

console.log(
  failures.length === 0
    ? '\nSECURITY CHECK PASSED'
    : `\nSECURITY CHECK FAILED: ${failures.length} check(s): ${failures.join('; ')}`,
);
process.exit(failures.length === 0 ? 0 : 1);
