import { test, type Page } from '@playwright/test';
import { diagnosticExchange } from './diagnostics';

/** The account-creation call made by the signup form (see docs/01-discovery.md). */
export const ACCOUNTS_PATH = '/api/accounts';

export const isCreation = (request: { url(): string; method(): string }): boolean =>
  request.method() === 'POST' && new URL(request.url()).pathname === ACCOUNTS_PATH;

export interface CreationExchange {
  status: number;
  /** JSON payload the browser sent. */
  request: Record<string, unknown>;
  /** Parsed JSON response, or the raw text if the body was not JSON. */
  body: unknown;
}

/**
 * Runs `action` (the click that submits the form) and returns the real request/response pair.
 * The response listener is registered before the action starts, so a fast response cannot be missed.
 * An allowlisted summary of the exchange (status, field names, no values) is attached to the test report.
 */
export async function captureCreation(page: Page, action: () => Promise<void>): Promise<CreationExchange> {
  const [response] = await Promise.all([page.waitForResponse((res) => isCreation(res.request())), action()]);
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw;
  }
  const exchange: CreationExchange = {
    status: response.status(),
    request: response.request().postDataJSON() as Record<string, unknown>,
    body,
  };
  await test.info().attach('signup-exchange.json', {
    body: JSON.stringify(diagnosticExchange(exchange), null, 2),
    contentType: 'application/json',
  });
  return exchange;
}

/** Counts account-creation requests leaving the browser; used to prove client-side validation blocks them. */
export function trackCreationRequests(page: Page): { count(): number } {
  let seen = 0;
  page.on('request', (request) => {
    if (isCreation(request)) seen += 1;
  });
  return { count: () => seen };
}
