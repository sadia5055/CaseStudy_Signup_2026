// Scanner used by `npm run test:security`. It looks for canary values in a directory tree and reports only
// WHERE and HOW MANY, never the values or the text around them.
//
// It reads plain files, and also the places a secret can hide: the zip embedded in a Playwright HTML report,
// zip files (such as traces), zips inside zips, and long base64 strings. Each canary is searched as the raw
// text, JSON-escaped, URL-encoded and base64-encoded, plus its random core on its own.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';
import { extname, join, relative } from 'node:path';

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webm', '.mp4', '.gif', '.woff2']);

export function variantsOf(secret, core) {
  const out = new Set();
  for (const s of [secret, core].filter(Boolean)) {
    out.add(s);
    out.add(JSON.stringify(s).slice(1, -1));
    out.add(encodeURIComponent(s));
    out.add(Buffer.from(s).toString('base64').replace(/=+$/, ''));
  }
  return [...out].filter((v) => v.length >= 12);
}

/** needles: { label: 'password', variants: string[] }[] */
export function makeNeedles(secrets) {
  return secrets.map(({ label, value, core }) => ({ label, variants: variantsOf(value, core) }));
}

// ---------- minimal zip reader / writer (stored or deflated entries) ----------
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);
    try {
      entries.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });
    } catch {
      /* unreadable entry: skipped */
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function makeZip(files, { deflate = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name);
    const body = deflate ? deflateRawSync(data) : data;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(deflate ? 8 : 0, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(header, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += header.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// ---------- scanning ----------
const count = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);

function scanBuffer(buf, needles, stats, depth = 0) {
  const found = {};
  const add = (label, n) => {
    if (n) found[label] = (found[label] ?? 0) + n;
  };
  const text = buf.toString('utf8');
  const lower = text.toLowerCase();
  for (const { label, variants } of needles) {
    // One value can appear as several variants of itself; report the highest count, case-insensitively.
    add(label, Math.max(0, ...variants.map((v) => count(lower, v.toLowerCase()))));
  }
  if (depth >= 4) return found;
  const merge = (child) => {
    for (const [k, v] of Object.entries(child)) add(k, v);
  };

  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) {
    for (const entry of readZip(buf)) {
      stats.zipEntries++;
      merge(scanBuffer(entry.data, needles, stats, depth + 1));
    }
  }
  const embedded = text.match(
    /<template id="playwrightReportBase64">data:application\/zip;base64,([A-Za-z0-9+/=]+)<\/template>/,
  );
  if (embedded) {
    for (const entry of readZip(Buffer.from(embedded[1], 'base64'))) {
      stats.zipEntries++;
      merge(scanBuffer(entry.data, needles, stats, depth + 1));
    }
  }
  // long base64 strings (attachment bodies are stored this way for non-text content)
  for (const token of (text.match(/[A-Za-z0-9+/]{48,}={0,2}/g) ?? []).slice(0, 2000)) {
    const decoded = Buffer.from(token, 'base64');
    if (decoded.length) {
      stats.base64Strings++;
      merge(scanBuffer(decoded, needles, stats, 4));
    }
  }
  return found;
}

/** Scans every file under `dir`. Returns findings [{ file, label, count }] and an inventory of what was covered. */
export function scanTree(dir, needles) {
  const findings = [];
  const inventory = {
    files: 0,
    bytes: 0,
    binarySkipped: 0,
    zipEntries: 0,
    base64Strings: 0,
    byExtension: {},
  };
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const ext = extname(name).toLowerCase() || '(none)';
      inventory.files++;
      inventory.byExtension[ext] = (inventory.byExtension[ext] ?? 0) + 1;
      if (BINARY.has(ext)) {
        inventory.binarySkipped++;
        continue;
      }
      const buf = readFileSync(full);
      inventory.bytes += buf.length;
      const found = scanBuffer(buf, needles, inventory);
      for (const [label, n] of Object.entries(found))
        findings.push({ file: relative(dir, full).replace(/\\/g, '/'), label, count: n });
    }
  };
  walk(dir);
  return { findings, inventory };
}
