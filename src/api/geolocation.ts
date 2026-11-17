import type { Page } from '@playwright/test';

/**
 * The signup page asks the app which country and province the visitor is in, and pre-selects the
 * province from the answer. The app answers by calling third-party IP-lookup services, so the result
 * depends on where the test runs: a US CI runner gets no Canadian province (docs/01-discovery.md).
 * Tests therefore pin the location with `stubGeolocation`. This is not the signup path; the
 * account-creation call is never stubbed.
 */
export const GEOLOCATION_PATH = '/api/geolocation/all';

export interface VisitorLocation {
  region: string;
  regionCode: string;
  country: string;
  countryCode: string;
}

export const ONTARIO_CA: VisitorLocation = {
  region: 'Ontario',
  regionCode: 'ON',
  country: 'Canada',
  countryCode: 'CA',
};

export const VIRGINIA_US: VisitorLocation = {
  region: 'Virginia',
  regionCode: 'VA',
  country: 'United States',
  countryCode: 'US',
};

/** Mirrors the real response: one entry per lookup provider. Documentation-range IP, no real data. */
export async function stubGeolocation(page: Page, location: VisitorLocation = ONTARIO_CA): Promise<void> {
  const entry = (provider: string, country: string) => ({
    ip: '203.0.113.7',
    provider,
    city: 'Example City',
    region: location.region,
    region_code: location.regionCode,
    country,
    country_code: location.countryCode,
    latitude: 0,
    longitude: 0,
    postal: '',
    error: false,
  });
  await page.route(
    (url) => url.pathname === GEOLOCATION_PATH,
    (route) =>
      route.fulfill({
        json: {
          'ipapi.co': entry('ipapi.co', location.country),
          'ipinfo.io': entry('ipinfo.io', location.countryCode), // this provider reports the country as a code
        },
      }),
  );
}
