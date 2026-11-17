# 04 — Decisions

Format: context → choice → trade-off. Newest at the bottom.

**D1 — Playwright + TypeScript.** The brief allows Cypress or Playwright, TypeScript preferred. Playwright has built-in projects (used for languages), network interception on the same page, and parallel workers. Trade-off: the author's strongest stack is Python; TypeScript was chosen because the role prefers it, and the suite stays small enough to defend line by line.

**D2 — Language as Playwright projects.** Alternatives: duplicate spec files (drift), a `LANG` env var read inside tests (hidden branching), a loop over languages inside each spec (unreadable reports). Projects give one command per language, separate report entries and no branching in specs. Trade-off: everything runs twice, so account-creating tests are kept few.

**D3 — Verify the UI-triggered request, not a direct API call.** The requirement is that the account-creation call made by the form returns 201 and contains what was entered. A direct `request.post` would not prove the form sends the right payload. The response listener is registered before the click. Trade-off: the test depends on the UI to reach the API; direct API tests are listed as future work.

**D4 — Three separate integration assertions (form → request → response → contract).** One big `toEqual` would say "something differs". Separate hops say where. Trade-off: slightly longer specs.

**D5 — zod subset contract with `passthrough`.** The account object has 60+ fields, most irrelevant (`*Specified` flags, tracking). Asserting all of them would break on harmless additions. Trade-off: a new field is not detected; the "no secrets echoed" rule is checked separately by key name.

**D6 — Email domain `mailinator.com`, configurable via `EMAIL_DOMAIN`.** Discovery showed `example.com` is rejected by the server (`placeholder email detected`), and the brief asks for throwaway addresses. Public inboxes are readable by anyone, so only fake data is used. Trade-off: if nesto blocks the domain, set `EMAIL_DOMAIN`; open question for nesto.

**D7 — Mock only failures.** `page.route` is used for 500/422/abort cases that cannot be triggered on demand. The success response is never mocked, because the brief asks for validation of the real integration.

**D8 — One page object, no base classes.** One page under test. A hierarchy would be structure without content.

**D9 — Chromium only.** Brief does not require cross-browser; every extra browser doubles the account-creating load on a shared QA environment. Listed as future work.

**D10 — Default `data-testid`, used sparingly.** The app already exposes `data-testid`, which is Playwright's default, so no config is needed. Accessible locators come first; test ids are for controls whose accessible name is weak.

**D11 — Wait for the geolocation response, then fill and verify.** The form re-initialises after the page loads: values typed too early are wiped, which shows up as unrelated "required" errors and looks like a validation bug. A first fix (wait for React hydration, verify each value after filling) still failed 8 of 40 runs, with a different set of tests each time, so the reset happens after the point where a value can be verified. Every load calls `GET /api/geolocation/all`; waiting for that response before interacting made the UI suite pass 120 of 120 runs (20 tests × 2 languages × 3 repeats). The cause is inferred from that result, not proven from the app's source. The page object also keeps a fill-and-verify loop (`toPass`) for the phone field, which reformats input. No fixed sleeps.

**D12 — Retries.** 0 locally, 1 in CI with trace on first retry. Intermittent failures are investigated (see the reliability notes in the review), not hidden.
