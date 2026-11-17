/** Paths of keys that look like a password anywhere inside `value` (used to prove none is echoed). */
export function passwordKeyPaths(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path ? `${path}.${key}` : key;
    return [...(/pass(word)?/i.test(key) ? [here] : []), ...passwordKeyPaths(child, here)];
  });
}
