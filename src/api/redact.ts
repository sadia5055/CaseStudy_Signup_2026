const SECRET_KEY = /pass|token|secret|authorization|cookie/i;

/** Copy of `value` with every secret-looking key replaced, safe to attach to a test report. */
export function redact(value: unknown, key = ''): unknown {
  if (SECRET_KEY.test(key) && value !== null && value !== undefined && value !== '') return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  return value;
}

/** Paths of keys that look like a password anywhere inside `value` (used to prove none is echoed). */
export function passwordKeyPaths(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path ? `${path}.${key}` : key;
    return [...(/pass(word)?/i.test(key) ? [here] : []), ...passwordKeyPaths(child, here)];
  });
}
