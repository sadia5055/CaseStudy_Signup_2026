# 02 — Test strategy

Scope: the signup page and the account-creation call it triggers. Out of scope: login, email delivery, the quote flow after signup, load and security testing.

Priorities follow business impact: a signup that fails, or stores something different from what was typed, loses the customer and corrupts the record every later step relies on. French is a legal expectation for consumer services in Quebec, so language parity is treated as part of functional correctness, not cosmetics.

Every test runs in both languages through Playwright projects (`en`, `fr`). "EN/FR" below means the same test body with localized expectations.

## Required automated coverage

| ID | Scenario | Business risk | Pri | Level | +/− | Expected result | Approach |
|---|---|---|---|---|---|---|---|
| P-01 | Valid signup, consent checked, defaults otherwise | Valid user cannot register | P0 | integration | + | Request `POST /api/accounts` returns **201**; response `account` matches submitted values; no password in response; redirect to `/getaquote` (`/fr` in French) | Real request, `waitForResponse` registered before click; zod contract + field-by-field comparison |
| P-02 | Valid signup, consent unchecked, QC, accented names (`Éloïse`, `Gagné-Côté`), formatted phone `(514) 555-0123` | Stored record differs from input; consent captured wrongly | P0 | integration | + | 201; names byte-identical; phone `+15145550123`; `region` `QC`; consent `false`; `preferredLanguage` equals project language | Same capture helper, different data |
| F-01 | Labels and controls present | Wrong or missing field | P1 | UI | + | Each field reachable by its localized label; correct control type (`tel`, `password`, `checkbox`); submit button localized | `getByLabel` with `Copy` |
| F-02 | Defaults | Silent pre-selection (consent pre-checked is a compliance defect) | P1 | UI | + | Country Canada, province Ontario, consent unchecked, passwords masked | state assertions |
| F-03 | Password rule hint | User cannot learn the rule | P2 | UI | + | Hint text localized and states 12–32 characters | text assertion |
| F-04 | Language switch | Broken or one-way toggle | P1 | UI | + | Toggle navigates to the other language URL; heading and labels change | click + `Copy` of target language |
| N-01 | Submit empty form | Invalid data reaches backend | P0 | UI | − | First/last name required, phone invalid, email invalid, password minimum; **no creation request sent** | submit, assert errors, assert request count 0 |
| N-02 | Invalid name (`12345`), whitespace-only name | Garbage in record | P1 | UI | − | "Invalid name" / "required"; no request | data-driven |
| N-03 | Malformed email (`plainaddress`, `user@domain`, `user@@example.com`) | Unreachable customer | P0 | UI | − | "Invalid email"; no request | data-driven |
| N-04 | Invalid phone (`123`, letters, `1234567890`) | Unreachable customer | P1 | UI | − | "Invalid value"; no request | data-driven |
| N-05 | Password rules: 11 chars, 33 chars, no upper, no lower, no digit | Weak credentials accepted | P0 | UI | − | Matching localized message per rule; no request | data-driven |
| N-06 | Confirmation mismatch | Customer locked out by typo | P0 | UI | − | "Passwords do not match"; no request | single test |

## High-value additional coverage

| ID | Scenario | Business risk | Pri | Level | +/− | Expected result | Approach |
|---|---|---|---|---|---|---|---|
| I-01 | Backend rejects (a: real 422 `placeholder email`; b: simulated 500; c: simulated network failure) | User sees success or a blank page when signup failed | P1 | integration | − | Generic localized error shown; URL stays on signup; no redirect | `page.route` fulfils/aborts **only** the failure; the success path is never mocked |
| I-02 | Duplicate email | Silent overwrite or confusing failure | P1 | integration | − | Second signup with the same email gets a non-201 response and the generic error; documents current behaviour (`400`), see open question 1 | create once through UI, repeat once |
| I-03 | Request payload reflects the form | Data lost between form and request | P1 | integration | + | Payload `phone` is E.164, `language` matches URL, `region` is a province code | asserted in P-01/P-02 on the captured request |

## Future recommendations (not built)

- Server-side validation parity through direct API calls, if the endpoint is confirmed callable without a browser session.
- Non-Canadian phone countries; email case/whitespace normalisation; concurrent duplicate submissions; double-click on submit.
- Mobile viewport and Firefox/WebKit projects; axe accessibility checks.
- Post-signup session (Auth0) and the quote page; email delivery and CRM side effects with a test inbox.
- Contract generated from an OpenAPI document once nesto provides one; cleanup of QA accounts once an API exists.

## Size and cost

26 tests per language, 52 per full run: 4 field/label tests (F-01…F-04), 16 data-driven validation cases (N-01…N-06 expand to 16), 3 account-creation tests (P-01, P-02, I-02) and 3 backend-failure tests (I-01a/b/c). Account-creating tests: P-01, P-02, I-02 → **3 accounts per language, 6 per full run** (I-01a is rejected by the backend, I-01b/c never reach it). Validation tests never submit a request, so they can be repeated freely. The QA environment is shared and has no known cleanup, which is why account-creating tests are kept few and everything else stops at client-side validation.

## What the suite will not claim

It does not prove server-side validation (client rules only), downstream email/CRM behaviour, or behaviour outside desktop Chromium.
