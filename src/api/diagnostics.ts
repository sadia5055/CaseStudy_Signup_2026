import type { CreationExchange } from './accounts';

const LANGUAGES = ['en', 'fr'];
const PROVINCES = ['ON', 'QC', 'AB', 'BC', 'MB', 'NB', 'NS', 'NL', 'PE', 'SK', 'NT', 'YT', 'NU'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value from a closed list, otherwise a placeholder: unexpected content is never copied. */
const oneOf = (value: unknown, allowed: string[]): string =>
  typeof value === 'string' && allowed.includes(value) ? value : '<other>';

/** Short plain text only (error codes). Anything that could carry an address or id is omitted. */
const plainText = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z0-9 _.:'-]{1,80}$/.test(value) ? value : '<omitted>';

/**
 * What is attached to the report for an account-creation call. It is built from an allowlist: status codes,
 * field NAMES, a few closed-list values (language, province) and booleans. It never contains the typed
 * values, the generated email, names, phone, ids, tracking ids or tokens, so nothing needs redacting later.
 */
export function diagnosticExchange(exchange: CreationExchange) {
  const body = isRecord(exchange.body) ? exchange.body : {};
  const account = isRecord(body.account) ? body.account : {};
  const parameters = Array.isArray(body.parameters) ? body.parameters.map(plainText) : undefined;
  return {
    status: exchange.status,
    request: {
      fields: Object.keys(exchange.request).sort(),
      language: oneOf(exchange.request.language, LANGUAGES),
      region: oneOf(exchange.request.region, PROVINCES),
      consent: exchange.request.leadDistributeConsentAgreement === true,
    },
    response: {
      topLevelKeys: Object.keys(body).sort(),
      accountFields: Object.keys(account).sort(),
      preferredLanguage: oneOf(account.preferredLanguage, LANGUAGES),
      region: oneOf(account.region, PROVINCES),
      consent: account.leadDistributeConsentAgreement === true,
      tokenPresent: 'token' in body,
      ...('error' in body ? { error: plainText(body.error) } : {}),
      ...(parameters ? { parameters } : {}),
    },
  };
}
