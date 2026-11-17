# 03 — Architecture

Playwright Test + TypeScript (strict). One runtime dependency besides Playwright: `zod`, for the response contract.

## Layers

```
tests/                       what is verified — arrange / act / assert, no selectors, no URLs
  ui/           fields.spec.ts · validation.spec.ts · layout.spec.ts
  integration/  signup-create.spec.ts · signup-failures.spec.ts
        │ imports `test`, `expect` from
src/fixtures/index.ts        extended test: lang, copy, signupPage, newUser
        │ composes
src/pages/signup.page.ts     UI driver: locators + user actions. Knows the DOM, not the API.
src/api/                     Integration layer: knows the HTTP contract, not the DOM.
  geolocation.ts               pins the visitor's location (the page's one other network dependency)
  accounts.ts                  endpoint matcher, `captureCreation(page, action)` → { request, response }
  account.schema.ts            zod contract for the 201 body (subset + "no secrets" rules)
  expected.ts                  form values → expected request/response values (E.164 phone, region code)
src/data/user.ts             `SignupUser` type, `buildUser(overrides)`, unique disposable email
src/i18n/                    en.ts, fr.ts, copy.ts — one `Copy` type, compiler enforces parity
src/config/env.ts            BASE_URL, EMAIL_DOMAIN with defaults, validated once
playwright.config.ts         projects = language × device (en, en-firefox, en-webkit, en-android, en-iphone, and the same for fr)
```

Dependencies point down only. One deliberate exception: the page object imports the geolocation path constant, because its "page is ready" signal is that response (D11). Specs never touch raw selectors; the page object never inspects network traffic; the API layer never touches the DOM. That is the whole rule, and it is what keeps a failure attributable: a locator problem fails in `pages/`, a contract problem fails in `api/`.

## How a signup test is wired

1. The `lang` option comes from the Playwright project (`en` or `fr`) and selects both the URL (`/signup` or `/fr/signup`) and the `copy` object.
2. `newUser()` returns unique data: `qa.auto.<run>.<worker>.<random>@<EMAIL_DOMAIN>`.
3. `captureCreation(page, () => signupPage.submit())` registers the `waitForResponse` **before** the click and returns the real request and response.
4. The spec asserts three hops separately: form → request payload, request → response body, response → schema. A failure names the hop where data was lost or changed.
5. Failure tests intercept with `page.route` and only fulfil/abort failures. A success is never mocked.

## Integration checks and why they are split this way

| Hop | Asserted by | Catches |
|---|---|---|
| form → request | `expected.ts` vs captured request | client formatting bugs (phone not E.164, wrong province code, wrong language) |
| request → response | field comparison in the spec | backend dropping or altering data (accents, casing, consent) |
| response → contract | `account.schema.ts` | missing/renamed fields, wrong types, secrets echoed (password must be absent) |

The schema validates only what the tests rely on (`passthrough`), plus the rule that no key matching `password` appears. A strict schema over the full account object (60+ fields) would fail on every harmless backend addition and teach reviewers to ignore it.

## Decisions kept simple

- One page object, no base page or component classes: there is one page.
- `getByLabel`/`getByRole` first; `data-testid` only for the province select and the submit button where the accessible name is weaker. Field ids are generated (`field-8`) and never used.
- Language and device are projects, not branches in specs and not duplicated folders. `--project="fr*"` runs French on every device; `--project=fr-iphone` runs one combination.
- Specs never ask "is this a phone?". Where the layout differs (the language switch moves into a hamburger menu on narrow screens), the page object branches on what is visible (`switchLanguage()`), so the same spec holds for tablets and resized windows too.
- Tests are independent: each creates its own data, nothing is shared or ordered, so `fullyParallel` is on. Account-creating tests are the only ones that write to QA.
- No retries locally; one retry in CI so a transient network error is visible in the report without hiding a real failure.

Rejected alternatives and reasons are in [`04-decisions.md`](04-decisions.md).

## Growth path (documented, not built)

| Next need | How the structure absorbs it |
|---|---|
| More pages (login, quote flow) | new `pages/*.page.ts` + `Copy` keys; fixtures and API layer unchanged |
| Test setup without the UI | `src/api` becomes a typed client; a `newAccount` fixture creates users by API and removes the UI from setup |
| More environments | `env.ts` entry; CI matrix over `BASE_URL` |
| White-label partner tenants / another language | new i18n file + project; specs unchanged (the app is multi-tenant: `_tenants/[tenant]`) |
| Contract ownership | replace `account.schema.ts` with types generated from nesto's OpenAPI, or consumer-driven contracts |
| Downstream integrations (email, CRM, identity) | separate `tests/integration/*` specs using a test inbox or stubs; the signup suite keeps stopping at the 201 |
| Suite size | tags (`@smoke`, `@integration`), sharding; a real-device cloud added as further projects |
| Quality signals | axe checks, flake tracking, trend reporting from CI artifacts |
