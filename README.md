# nesto signup — Playwright + TypeScript

Automated tests for `https://app.qa.nesto.ca/signup` in English and French: form fields and labels, client-side validation, and the account-creation API (`POST /api/accounts` must return 201 with the entered data). Written for the Senior QA Automation Developer – Integrations exercise.

The submission includes the working notes, not only the code: see [Process documents](#process-documents).

## Run it

Needs Node 20 or newer and git.

```bash
npm ci
npx playwright install chromium
npm test
```

| Goal | Command |
|---|---|
| Everything, both languages | `npm test` |
| English only | `npm run test:en` |
| French only | `npm run test:fr` |
| UI specs only (creates no accounts) | `npm run test:ui` |
| One test | `npx playwright test -g "P-01" --project=fr` |
| One file | `npx playwright test tests/integration/signup-create.spec.ts` |
| Open the HTML report | `npm run report` |
| Typecheck / lint / format check | `npm run typecheck` · `npm run lint` · `npm run format:check` |

Optional environment variables (defaults in [`src/config/env.ts`](src/config/env.ts)):

| Variable | Default | Use |
|---|---|---|
| `BASE_URL` | `https://app.qa.nesto.ca` | another environment |
| `EMAIL_DOMAIN` | `mailinator.com` | throwaway address domain; the backend rejects `example.com` |

**A full run creates 6 accounts in QA** (3 per language). The assessment allows this; there is no cleanup.

## What it checks

| Area | Tests | Notes |
|---|---|---|
| Fields and labels | F-01 … F-04 | labels, control types, defaults (consent unchecked), password hint, language switch |
| Validation (negative) | N-01 … N-06, 16 cases | one data table; each case asserts the localized message, that nothing else is flagged, and that **no creation request is sent** |
| Account creation (positive) | P-01, P-02 | real UI-triggered request; **201**, then form → request → response → contract |
| Duplicate email | I-02 | second signup is refused and the error is shown |
| Backend failures | I-01a/b/c | real 422 for a placeholder email; simulated 500 and network failure; user stays on the form |

26 tests per language, 52 per run. The matrix with business risks is in [`docs/02-test-strategy.md`](docs/02-test-strategy.md).

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

- Local, Windows, Chromium: **52/52 passed on three consecutive full runs** (parallel, 4 workers), and again on a fourth run with the final committed code. A fresh `git clone` + `npm ci` passes typecheck, lint and format checks and runs the tests. Fixes made along the way are in [`docs/06-review.md`](docs/06-review.md).
- UI specs: 120/120 over three repeats of both languages.
- Mutation check: changing one expected value (`preferredLanguage`) fails P-01 with a field-level diff.
- **GitHub Actions workflow is written but has not run.** Whether GitHub-hosted runners can reach QA is unknown until it is pushed.

## Known limitations

- **Client-side rules only.** Server-side validation is not tested because that would mean bypassing the form; the endpoint was not probed directly.
- **Desktop Chromium only.** No mobile viewport, Firefox or WebKit.
- **Dependency on `GET /api/geolocation/all`.** The form resets after that call returns, so the page object waits for it ([D11](docs/04-decisions.md)). If the app stops calling it, every test times out in `goto()`.
- **"No request sent" is checked right after the errors render.** A request fired later would be missed.
- **I-01a relies on a backend rule** (`example.com` is rejected). If nesto removes it, that test fails and should be revised.
- **Failure artifacts contain typed values.** Playwright writes the form's values, including the random throwaway password, into `error-context.md` and the HTML report when a test fails. Signup tokens never appear. See [D16](docs/04-decisions.md); do not run this against an environment with real data.
- **Public inbox domain.** Mailinator addresses are readable by anyone; tests use only fake data. Override with `EMAIL_DOMAIN` if nesto prefers another domain.
- Current wording is pinned where a message is needed (for example "letters" in the password messages, which is [BUG-3](docs/05-bug-reports.md)); the FR password hint is matched by pattern so the typo is not enshrined.

## What I would add next

Server-side validation checks through direct API calls once the endpoint is confirmed callable; mobile viewport and Firefox/WebKit projects; axe accessibility checks; non-Canadian phone countries; email case and whitespace normalisation; concurrent and double-click submits; the post-signup session and quote page; email/CRM side effects with a test inbox; a contract generated from nesto's OpenAPI document; and a nightly run once nesto confirms automated signups from CI are fine.

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
| [`scripts/`](scripts) | the two probe scripts used during discovery (not part of the suite) |
