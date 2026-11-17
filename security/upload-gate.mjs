// CI gate: refuses to let files be uploaded if they contain anything shaped like a credential or an account
// identifier. It is a second line of defence behind the allowlisted summary; it checks the FORMATS this suite
// generates (there are no canaries in a real run). Prints only file paths and rule names, never matched text.
//
// Usage: node security/upload-gate.mjs <directory>
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RULES = [
  ['generated password (Qa1-<hex>)', /Qa1-[0-9a-f]{8,}/],
  ['generated account email (qa.auto.*@)', /qa\.auto\.[a-z0-9]+\.\d+\.[0-9a-f]{6}@/i],
  ['any mailinator address', /@mailinator\.com/i],
  ['JWT-shaped token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ['bearer / authorization value', /(?:bearer|authorization)["'\s:=]+[A-Za-z0-9._-]{20,}/i],
  ['cookie header', /(?:set-cookie|"cookie")\s*[:=]/i],
  ['auth client_id in a URL', /client_id=[A-Za-z0-9]{10,}/],
  ['absolute user path', /[A-Za-z]:\\+Users\\|\/home\/runner\/|\/Users\/[a-z]/],
];

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node security/upload-gate.mjs <directory>');
  process.exit(2);
}

const hits = [];
let files = 0;
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const full = join(d, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    files++;
    const text = readFileSync(full, 'utf8');
    for (const [rule, rx] of RULES) if (rx.test(text)) hits.push(`${relative(dir, full)}: ${rule}`);
  }
};
walk(dir);

if (files === 0) {
  console.error(`upload gate: no files found in ${dir}, refusing to pass an empty selection`);
  process.exit(1);
}
if (hits.length > 0) {
  console.error(`upload gate FAILED (${hits.length} finding(s); matched text is never printed):`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`upload gate passed: ${files} file(s) checked against ${RULES.length} rules`);
