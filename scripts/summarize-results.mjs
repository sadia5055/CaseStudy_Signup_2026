// Builds a sanitized, allowlisted test summary from a Playwright JSON report.
//
// Usage: node scripts/summarize-results.mjs <results.json> <output-dir>
//
// ALLOWLIST: the only things read from the raw report are test titles, project names, outcomes, durations
// and attempt counts, plus run totals and tool versions. Steps, errors, stack traces, stdout/stderr,
// attachments, annotations, file paths and anything typed into the form are never read, so even a report
// that contains secrets produces a clean summary. `npm run test:security` proves this with canary values.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , inputPath, outDir] = process.argv;
if (!inputPath || !outDir) {
  console.error('usage: node scripts/summarize-results.mjs <results.json> <output-dir>');
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));

const rows = [];
const collect = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      rows.push({
        title: String(spec.title).slice(0, 160),
        project: String(test.projectName),
        outcome: ['expected', 'unexpected', 'flaky', 'skipped'].includes(test.status)
          ? test.status
          : 'unexpected',
        durationMs: Math.round(results.reduce((sum, r) => sum + (Number(r.duration) || 0), 0)),
        attempts: results.length,
      });
    }
  }
  for (const child of suite.suites ?? []) collect(child);
};
for (const suite of raw.suites ?? []) collect(suite);

const mark = { expected: 'PASS', unexpected: 'FAIL', flaky: 'FLAKY', skipped: 'SKIP' };
const total = rows.length;
const count = (outcome, subset = rows) => subset.filter((r) => r.outcome === outcome).length;

const projects = [...new Set(rows.map((r) => r.project))];
const titles = [...new Set(rows.map((r) => r.title))].sort();
const byKey = new Map(rows.map((r) => [`${r.title}\u0000${r.project}`, r]));

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const meta = {
  commit: (process.env.GITHUB_SHA || git('rev-parse', 'HEAD')).slice(0, 7) || 'unknown',
  generatedUtc: new Date().toISOString().slice(0, 16).replace('T', ' '),
  runStartedUtc: String(raw.stats?.startTime ?? '')
    .slice(0, 19)
    .replace('T', ' '),
  wallClockSeconds: Math.round((raw.stats?.duration ?? 0) / 1000),
  playwright: raw.config?.version ?? 'n/a',
  node: process.version,
  environment: process.env.GITHUB_ACTIONS ? 'GitHub Actions' : `${process.platform} local run`,
  workers: raw.config?.workers ?? null,
};
const overall = {
  executions: total,
  passed: count('expected'),
  failed: count('unexpected'),
  flaky: count('flaky'),
  skipped: count('skipped'),
};
const perProject = projects.map((project) => {
  const subset = rows.filter((r) => r.project === project);
  return {
    project,
    executions: subset.length,
    passed: count('expected', subset),
    failed: count('unexpected', subset),
    flaky: count('flaky', subset),
    summedTestSeconds: Math.round(subset.reduce((s, r) => s + r.durationMs, 0) / 100) / 10,
  };
});

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'test-summary.json'),
  JSON.stringify({ meta, overall, perProject, tests: rows }, null, 2) + '\n',
);

// ---------- Markdown (also used for the GitHub run summary page) ----------
const md = [
  '# Test execution summary (sanitized)',
  '',
  `**${overall.passed} of ${overall.executions} executions passed** (${overall.failed} failed, ${overall.flaky} flaky, ${overall.skipped} skipped)`,
  '',
  `Commit \`${meta.commit}\` · Playwright ${meta.playwright} · Node ${meta.node} · ${meta.environment} · ` +
    `run started ${meta.runStartedUtc} UTC · wall clock ${Math.floor(meta.wallClockSeconds / 60)} min ${meta.wallClockSeconds % 60} s`,
  '',
  '## By project',
  '',
  '| Project | Passed | Failed | Flaky | Summed test time |',
  '|---|---:|---:|---:|---:|',
  ...perProject.map(
    (p) =>
      `| \`${p.project}\` | ${p.passed}/${p.executions} | ${p.failed} | ${p.flaky} | ${p.summedTestSeconds} s |`,
  ),
  '',
  '## By test',
  '',
  `| Test | ${projects.map((p) => `\`${p}\``).join(' | ')} |`,
  `|---|${'---|'.repeat(projects.length)}`,
  ...titles.map((title) => {
    const cells = projects.map((p) => {
      const r = byKey.get(`${title}\u0000${p}`);
      return r ? `${mark[r.outcome]} ${(r.durationMs / 1000).toFixed(1)}s` : '–';
    });
    return `| ${title.replace(/\|/g, '\\|')} | ${cells.join(' | ')} |`;
  }),
  '',
  'Included: test titles, project names, outcomes, durations, run metadata. Left out by design: test steps, form values, ' +
    'emails, passwords, request and response bodies, tokens, cookies, screenshots, stack traces, error text, file paths.',
  '',
];
writeFileSync(join(outDir, 'test-summary.md'), md.join('\n'));

// ---------- Static HTML: no scripts, no external requests ----------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cls = { expected: 'ok', unexpected: 'bad', flaky: 'warn', skipped: 'skip' };
const head = projects.map((p) => `<th scope="col">${esc(p)}</th>`).join('');
const bodyRows = titles
  .map((title) => {
    const tds = projects
      .map((p) => {
        const r = byKey.get(`${title}\u0000${p}`);
        return r
          ? `<td class="${cls[r.outcome]}"><b>${mark[r.outcome]}</b> ${(r.durationMs / 1000).toFixed(1)}s</td>`
          : '<td>–</td>';
      })
      .join('');
    return `<tr><th scope="row">${esc(title)}</th>${tds}</tr>`;
  })
  .join('\n');
const projRows = perProject
  .map(
    (p) =>
      `<tr><th scope="row"><code>${esc(p.project)}</code></th><td>${p.passed}/${p.executions}</td><td>${p.failed}</td><td>${p.flaky}</td><td>${p.summedTestSeconds} s</td></tr>`,
  )
  .join('\n');
writeFileSync(
  join(outDir, 'test-summary.html'),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Signup tests: execution summary</title>
<style>
:root{--bg:#f5f3ee;--card:#e9e6dd;--ink:#16202e;--body:#3b4656;--ok:#17695f;--bad:#a02a17;--warn:#8a5a00;--line:#cfcabd}
@media (prefers-color-scheme:dark){:root{--bg:#16202e;--card:#202c3d;--ink:#f5f3ee;--body:#c9d1dc;--ok:#6fd1c3;--bad:#ff8a65;--warn:#ffcf70;--line:#3a475a}}
body{margin:0;font:16px/1.5 system-ui,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--body)}
main{max-width:1200px;margin:0 auto;padding:32px 16px 64px}h1,h2{color:var(--ink)}h1{font-size:28px;margin:0 0 8px}h2{font-size:20px;margin:28px 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0}.card{background:var(--card);border-radius:12px;padding:14px 16px}.card b{display:block;font-size:28px;color:var(--ink)}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}thead th{background:var(--card);color:var(--ink)}tbody th{color:var(--ink);font-weight:500;white-space:normal;min-width:240px}
td.ok b{color:var(--ok)}td.bad b{color:var(--bad)}td.warn b{color:var(--warn)}.note{font-size:14px}
</style></head><body><main>
<h1>Signup test automation: execution summary</h1>
<p class="note">Commit <code>${esc(meta.commit)}</code> · Playwright ${esc(meta.playwright)} · Node ${esc(meta.node)} · ${esc(meta.environment)} · run started ${esc(meta.runStartedUtc)} UTC</p>
<div class="cards">
<div class="card"><b>${overall.passed}/${overall.executions}</b>executions passed</div>
<div class="card"><b>${overall.failed}</b>failed</div>
<div class="card"><b>${overall.flaky}</b>flaky</div>
<div class="card"><b>${Math.floor(meta.wallClockSeconds / 60)} min ${meta.wallClockSeconds % 60} s</b>wall clock</div>
</div>
<h2>By project</h2>
<div class="wrap"><table><thead><tr><th>Project</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Summed test time</th></tr></thead><tbody>${projRows}</tbody></table></div>
<h2>By test</h2>
<div class="wrap"><table><thead><tr><th scope="col">Test</th>${head}</tr></thead><tbody>${bodyRows}</tbody></table></div>
<p class="note">Included: test titles, project names, outcomes, durations, run metadata. Left out by design: steps, form values, emails, passwords, request and response bodies, tokens, cookies, screenshots, stack traces, error text and file paths. This page loads no scripts and makes no network requests.</p>
</main></body></html>
`,
);

console.log(
  `summary: ${overall.passed}/${overall.executions} passed, ${overall.failed} failed, ${overall.flaky} flaky -> ${outDir}`,
);
