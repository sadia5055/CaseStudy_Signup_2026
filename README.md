# nesto signup — Playwright + TypeScript

Automated tests for `https://app.qa.nesto.ca/signup` in English and French, on desktop Chrome, Firefox, Safari (WebKit), an Android phone and an iPhone: form fields and labels, client-side validation, mobile layout, and the account-creation API (`POST /api/accounts` must return 201 with the entered data). Written for the Senior QA Automation Developer – Integrations exercise.

**Technical walkthrough:** [presentation PDF, 14 slides](presentation/nesto-signup-test-automation.pdf). It covers the approach, the integration check, what went wrong and the evidence.

The submission includes the working notes, not only the code: see [Process documents](#process-documents).

## Run it

Needs Node 20 or newer and git.

```bash
npm ci
npx playwright install chromium firefox webkit
npm test
```

| Goal | Command |
|---|---|
| Everything: 2 languages × 5 devices | `npm test` |
| Quick run: desktop Chrome only | `npm run test:chrome` |
| Phones only (Pixel 7, iPhone 14) | `npm run test:mobile` |
| English on every device | `npm run test:en` |
| French on every device | `npm run test:fr` |
| UI specs only (creates no accounts) | `npm run test:ui` |
| One test, one device | `npx playwright test -g "P-01" --project=fr-iphone` |
| One file | `npx playwright test tests/integration/signup-create.spec.ts` |
| Open the HTML report | `npm run report` |
| Typecheck / lint / format check | `npm run typecheck` · `npm run lint` · `npm run format:check` |

Optional environment variables (defaults in [`src/config/env.ts`](src/config/env.ts)):

| Variable | Default | Use |
|---|---|---|
| `BASE_URL` | `https://app.qa.nesto.ca` | another environment |
| `EMAIL_DOMAIN` | `mailinator.com` | throwaway address domain; the backend rejects `example.com` |

Projects are language × device: `en`, `en-firefox`, `en-webkit`, `en-android`, `en-iphone` and the same five for `fr`. Plain `en` / `fr` are desktop Chrome.

**A full run creates 30 accounts in QA** (3 per project); `npm run test:chrome` creates 6. The assessment allows this; there is no cleanup.

## What it checks

| Area | Tests | Notes |
|---|---|---|
| Fields and labels | F-01 … F-05 | labels, control types, defaults (consent unchecked), password hint, language switch (header link on wide screens, hamburger-menu picker on phones) |
| Mobile layout | L-01 … L-03 | no horizontal scroll, every control within the viewport width, longest French error does not widen the page |
| Validation (negative) | N-01 … N-06, 16 cases | one data table; each case asserts the localized message, that nothing else is flagged, and that **no creation request is sent** |
| Account creation (positive) | P-01, P-02 | real UI-triggered request; **201**, then form → request → response → contract |
| Duplicate email | I-02 | second signup is refused and the error is shown |
| Backend failures | I-01a/b/c | real 422 for a placeholder email; simulated 500 and network failure; user stays on the form |

30 tests per project, 300 per full run. The matrix with business risks is in [`docs/02-test-strategy.md`](docs/02-test-strategy.md).

### The integration check

For a successful signup the test listens for the form's own `POST /api/accounts` (listener registered before the click), then asserts three things separately so a failure says where data was lost:

1. **form → request:** phone is E.164, `region` is a province code, `language` matches the URL;
2. **request → response:** names (including accents), email, phone, region, language and consent come back unchanged, and no password key appears in the response;
3. **response → contract:** a [zod schema](src/api/account.schema.ts) covers the fields the tests rely on.

The success path is never mocked. Only failures are simulated.

## How it is built

```
tests/ui · tests/integration   specs: arrange / act / assert
src/fixtures                   one extended `test`: lang, copy, signupPage, newUser
src/pages/signup.page.ts       DOM only
src/api                        HTTP only: capture, contract, expected values, redaction
src/i18n                       en.ts / fr.ts against one Copy type (a missing translation fails the build)
src/data · src/config          unique user data, environment
```

Language is a Playwright project (`en`, `fr`), so there is one set of specs and one command per language. Dependencies point downwards only. Architecture, layer rules and the growth path are in [`docs/03-architecture.md`](docs/03-architecture.md); every choice with its rejected alternative is in [`docs/04-decisions.md`](docs/04-decisions.md).

## Results so far

- Local, Windows, all 10 projects (2 languages × desktop Chrome, Firefox, WebKit, Pixel 7, iPhone 14), after the fixes for the first CI run: **600/600 passed** (the full suite of 300 tests run twice, parallel, 13 minutes). The run just before the last fix had 299/300; the one failure (`fr-webkit` L-02) was traced to my own readiness check and fixed ([D21](docs/04-decisions.md)), then passed 80/80 when repeated. Earlier, before devices and the CI fixes, desktop Chrome passed 52/52 on four consecutive runs and a fresh `git clone` + `npm ci` passed typecheck, lint and format checks. All findings along the way are in [`docs/06-review.md`](docs/06-review.md).
- The first phone run found one real gap: the language switch is a hamburger-menu picker on phones, so F-04 failed on all four phone projects until the page object handled it ([D17](docs/04-decisions.md)). No layout defects were found on phones.
- Mutation check: changing one expected value (`preferredLanguage`) fails P-01 with a field-level diff.
- **GitHub Actions: the first run [failed](https://github.com/sadia5055/CaseStudy_Signup_2026/actions/runs/44118433451); after the fixes the next run [passed all six jobs](https://github.com/sadia5055/CaseStudy_Signup_2026/actions/runs/44128638174)** (static checks plus Chrome, Firefox, WebKit, Android and iPhone; run 2 on commit `c72bca2`). Causes of the first failure (details in [`docs/06-review.md`](docs/06-review.md)): the province default depends on the visitor's IP, so a US runner saw an empty select (F-02 was wrong; the location is now stubbed, F-05 covers the non-Canadian case); a geolocation wait timed out once; and the Auth0 redirect after signup is slower on CI than 10 s.

## Known limitations

- **Client-side rules only.** Server-side validation is not tested because that would mean bypassing the form; the endpoint was not probed directly.
- **Phones are emulated, not real.** Pixel 7 and iPhone 14 are Playwright device profiles (viewport, user agent, touch; the iPhone runs the real WebKit engine). Mobile keyboards, autofill, native pickers and real iOS Safari behaviour are not covered. Firefox is desktop only, and the hamburger breakpoint width was not measured.
- **Geolocation is stubbed.** The form resets after `GET /api/geolocation/all` returns and pre-selects the province from the visitor's IP, which varies by machine and depends on third-party lookups, so the tests pin an Ontario location ([D19](docs/04-decisions.md)). The real lookup is not exercised. If the app stops calling that endpoint, `goto()` times out.
- **"No request sent" is checked right after the errors render.** A request fired later would be missed.
- **I-01a relies on a backend rule** (`example.com` is rejected). If nesto removes it, that test fails and should be revised.
- **Failure artifacts contain typed values.** Playwright writes the form's values, including the random throwaway password, into `error-context.md` and the HTML report when a test fails. Signup tokens never appear. See [D16](docs/04-decisions.md); do not run this against an environment with real data.
- **Public inbox domain.** Mailinator addresses are readable by anyone; tests use only fake data. Override with `EMAIL_DOMAIN` if nesto prefers another domain.
- Current wording is pinned where a message is needed (for example "letters" in the password messages, which is [BUG-3](docs/05-bug-reports.md)); the FR password hint is matched by pattern so the typo is not enshrined.

## What I would add next

Server-side validation checks through direct API calls once the endpoint is confirmed callable; real devices through a device cloud, tablet and landscape sizes, and widths around the hamburger breakpoint; axe accessibility checks; non-Canadian phone countries; email case and whitespace normalisation; concurrent and double-click submits; the post-signup session and quote page; email/CRM side effects with a test inbox; a contract generated from nesto's OpenAPI document; and a nightly run once nesto confirms automated signups from CI are fine.

## How it was made

Built with Claude Code as an assistant: it drove the browser to explore the app, drafted the code and documents, and ran the tests. The decisions, the checks of each claim against the live page, and the review are recorded in the process documents below.

## Process documents

| Document | Content |
|---|---|
| [`docs/01-discovery.md`](docs/01-discovery.md) | what was observed on the live app: form inventory, validation results, API exchange, open questions |
| [`docs/02-test-strategy.md`](docs/02-test-strategy.md) | risk-based matrix: required, additional, future |
| [`docs/03-architecture.md`](docs/03-architecture.md) | layers, rules, how a test is wired, growth path |
| [`docs/04-decisions.md`](docs/04-decisions.md) | decision log with trade-offs |
| [`docs/05-bug-reports.md`](docs/05-bug-reports.md) | confirmed defects and items needing clarification |
| [`docs/06-review.md`](docs/06-review.md) | self-review: what was found wrong, fixed, accepted |
| [`ASSUMPTIONS.md`](ASSUMPTIONS.md) | numbered assumptions with the question for nesto where there is one |
| [`scripts/`](scripts) | the probe scripts used during discovery and debugging (not part of the suite) |
