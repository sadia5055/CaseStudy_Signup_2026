# 06 — Review

A second pass over the finished work, written as a skeptical reviewer. Each item says what was found, how, and what was done. "Accepted" means it is still true and is listed in the README limitations.

## Found and fixed

| # | Finding | How it was found | Fix |
|---|---|---|---|
| 1 | F-03 and F-04 never navigated to the page (they used `page`, not the `signupPage` fixture). | First UI run: 2 failures with "element(s) not found". | Both tests now request `signupPage`. |
| 2 | Validation tests failed intermittently with extra "required" errors, a different set each run (8 of 40). The first fix (wait for hydration, verify values) did not remove it. | Failures were not reproducible per test, and the failing field was empty even though the fill helper had confirmed its value. | Wait for `GET /api/geolocation/all` before interacting ([D11](04-decisions.md)). 120/120 afterwards. The cause is inferred from the result, not proven. |
| 3 | `toPass()` had no timeout, so a field that never kept its value would hang until the 45 s test timeout. | Reading the fill helper. | Bounded to 10 s in `playwright.config.ts`. |
| 4 | `format:check` failed on Windows: `git checkout` restored a file with CRLF. | Static checks run after a revert. | `.gitattributes` pins LF; renormalized. |
| 5 | The claim "no secrets in artifacts" was false for failing runs: Playwright's `error-context.md` contains typed field values. | Grepped the HTML report and `test-results/` for the generated password prefix. | Claim corrected; accepted and documented as [D16](04-decisions.md). Tokens: 0 JWT-shaped strings in any artifact. |
| 6 | Several documents said more than was observed: "validation runs on submit" (blur was not tested); the plan assumed a custom test-id attribute (it is the default `data-testid`); a French logo link was listed as a defect (EN uses the same `/`); D12 mentioned traces that are off; the strategy gave the wrong test count. | Re-verifying each claim against the page and the code. | Wording narrowed, logo moved to "needs clarification", D12 and strategy corrected. |
| 7 | The first discovery run reported "silent failure" on a 422. | Rerun with a longer wait: the toast had not rendered yet when the probe looked. | Not a defect; the generic error is shown (I-01a asserts it). |

## Found during the device pass

| # | Finding | How it was found | Outcome |
|---|---|---|---|
| 8 | F-04 failed on all four phone projects: the header language link is replaced by a hamburger-menu picker on narrow screens. | First run on Pixel 7 / iPhone 14: 4 failures, everything else green. | Test gap, not an app bug. `switchLanguage()` follows what is visible ([D17](04-decisions.md)). |
| 9 | I first concluded the mobile language control was a non-focusable `DIV` that did nothing when tapped. Both conclusions were wrong. | Re-probing: it is a `<button aria-haspopup>`, and its popup items have role `menuitemradio`; my search had looked for `menuitem` and `option`. | Not reported as a bug. Recorded here because a quick probe nearly produced a false defect. |
| 10 | Real accessibility findings on phones: the hamburger button's `aria-label` is English on the French page; the language picker button is named "Menu". | Attribute reads in both languages. | BUG-5 (confirmed) and C-8 (needs clarification). |
| 11 | The new layout checks could pass vacuously if the overflow measurement could not see overflow. | At 200 px the page reported 0, which proved nothing. | Injected a 2000 px element: 0 → 1610. The measurement works ([D18](04-decisions.md)). |

## Checked and holding

- **Assertions can fail.** Changing the expected `preferredLanguage` made P-01 fail with `- "fr" / + "en"`; reverted.
- **Independence.** Every test builds its own user (unique email from run id, worker index and random bytes) and nothing is shared; the suite passed 52/52 three times in parallel.
- **No sleeps.** No `waitForTimeout`; waits are for a response, a locator state, or a retried assertion.
- **Language parity is enforced by the compiler**: `en.ts` and `fr.ts` both implement `Copy`.
- **No secrets in the repository.** Passwords are generated per test; `.env` is ignored; probe scripts redact `pass`/`token` keys.

## Accepted weaknesses

| # | Weakness | Why it stays |
|---|---|---|
| A | "No request sent" is asserted right after the errors appear, so a request fired later would be missed. | The app validates synchronously in the submit handler; a fixed wait would be the only alternative. |
| B | The suite depends on an unrelated endpoint (`/api/geolocation/all`) answering. | It is the only reliable "form is ready" signal found; the failure mode is a loud timeout in `goto()`, not a false pass. |
| C | I-02 only asserts "4xx and an error is shown". | The intended duplicate behaviour is an open question to nesto (C-1 in the bug reports); pinning `400` would encode a guess. |
| D | I-01a depends on a backend rule about placeholder domains. | It tests a real rejection without mocking; it will need revising if the rule changes. |
| E | Error messages pin the current "letters" wording (BUG-3). | The tests need some expected text; the hint with the typo is matched by pattern instead. |
| F | CI has not run. | Cannot be verified before pushing; the README says so. |
| G | Client-side validation only. | Server-side checks would mean bypassing the form. |
| H | Phones are Playwright emulations, not real devices; tablets, landscape and the hamburger breakpoint width are not covered. | Real devices need a device cloud; listed as the next step. A full run also creates 30 accounts in QA, so `npm run test:chrome` exists for quick runs. |

## Open

- Questions for nesto are collected in `ASSUMPTIONS.md` (A2, A4–A7) and `05-bug-reports.md` (section B).
