// Environment settings. Defaults point at the QA environment named in the assessment.
// Nothing here is secret; test passwords are generated per test (see data/user.ts).

function read(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

const baseURL = read('BASE_URL', 'https://app.qa.nesto.ca');
const emailDomain = read('EMAIL_DOMAIN', 'mailinator.com');

try {
  new URL(baseURL);
} catch {
  throw new Error(`BASE_URL is not a valid URL: "${baseURL}"`);
}
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailDomain)) {
  throw new Error(`EMAIL_DOMAIN is not a valid domain: "${emailDomain}"`);
}

export const env = { baseURL, emailDomain } as const;
