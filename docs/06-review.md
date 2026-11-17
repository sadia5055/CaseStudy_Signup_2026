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

## Found by the first CI run

The first GitHub Actions run (commit `e900887`) failed on all five jobs. Three causes:

| # | Finding | How it was found | Outcome |
|---|---|---|---|
| 12 | F-02 asserted "province = Ontario", which was true only on my machine. The page pre-selects the province from the visitor's IP; a US runner gets an empty select. 10 of 10 projects failed. | CI log: expected `"ON"`, received `""`. The geolocation endpoint's response shape confirmed the cause; a Virginia stub reproduces the empty province in all 10 projects (F-05). | Location is pinned by a stub ([D19](04-decisions.md)); F-02 and F-05 cover both cases. The wrong assumption is also corrected in the discovery notes. |
| 13 | The readiness wait from D11 (wait for `/api/geolocation/all`) timed out after 45 s on one CI test (`en-android`, N-04). This was the weakness listed as "accepted B" in the first review; it happened. | CI log: `page.waitForResponse: Test timeout of 45000ms exceeded` inside `goto()`. | The stub makes the wait immediate and removes the third-party dependency ([D19](04-decisions.md)). |
| 14 | P-01's redirect check (10 s) failed on chrome and WebKit and flaked on Firefox: the Auth0 round trip is slower from CI. | CI log: still on `/fr/signup`, "waiting for navigation to auth.qa.nesto.ca/authorize to finish". | 30 s for that check, 60 s per test ([D20](04-decisions.md)). Confirmed on the next CI run (one run). |

| 15 | After the stub (finding 12/13), one run in 300 failed: `fr-webkit` L-02 saw six inputs with the same id. It reproduced 3 times in 30. | Repeated the single test, then probed the page directly: at the moment of "ready", 15 of 40 stubbed WebKit loads had duplicate ids; 0 of 40 with the real response or on other engines. | Own flaw: the instant stub outran hydration. Readiness now requires unique input ids ([D21](04-decisions.md)); 80 of 80 afterwards. |

Lesson recorded: the local runs all passed because my machine matched the assumptions. An environment-dependent default and a slow third-party hop were both invisible until the suite ran somewhere else.

## Found by the pre-publication security audit

| # | Finding | How it was found | Outcome |
|---|---|---|---|
| 16 | The generated passwords were in the step titles of the HTML report that CI uploaded on **every** run. My earlier D16 said only failures leaked and accepted it; both were wrong. | A scratch run of passing tests with the CI configuration, scanned for the generated format; then a canary lab measuring each Playwright mechanism. | Entered through `evaluate`; the report no longer holds them ([D22](04-decisions.md), [07](07-security-remediation.md)). D16 rewritten. |
| 17 | `error-context.md` copied typed values from the page into every failing test's output. | Same scan. | `PLAYWRIGHT_NO_COPY_PROMPT=1`; pinned by the security test. |
| 18 | I assumed boxed test steps might hide the values. They do not. | Measured in the lab (T03). | Not used. |
| 19 | Assertions such as `toHaveValue(secret)` and `toMatchObject` print values into logs and reports. | Lab scenarios T07 and T11. | Field-name and boolean comparisons. |
| 20 | `toHaveURL` in P-01 prints the full URL on failure, which after signup can carry OAuth `code` and `state` into public logs. | My own skeptical review of the remediation, after the security test was green. | `expectToLandOn` prints the path only; scenario C6 and mutation M5 guard it. |
| 21 | Three `en-firefox` timeouts in a loaded 4-worker run. | Failed local run, then timing, worker-count and old/new-code experiments. | CPU contention, not QA or test logic; workers capped at 2 ([D25](04-decisions.md), [08](08-firefox-reliability.md)). |

Final full run on the remediated code: 300/300 executions passed, 0 failed, 0 flaky, 0 retried, in 8 min 23 s (2 workers, CPU average 59%, slowest execution 11.1 s against the 60 s limit; Firefox median 3.1 s, p90 6.3 s).

## Checked and holding

- **Assertions can fail.** Changing the expected `preferredLanguage` made P-01 fail with `- "fr" / + "en"`; reverted.
- **Independence.** Every test builds its own user (unique email from run id, worker index and random bytes) and nothing is shared. The full matrix (30 tests per project × 10 projects = 300 executions per run) passed twice, totaling 600/600 successful executions locally, in parallel. (Earlier, desktop Chrome alone passed 52/52 on four consecutive parallel runs.)
- **No sleeps.** No `waitForTimeout`; waits are for a response, a locator state, or a retried assertion.
- **Language parity is enforced by the compiler**: `en.ts` and `fr.ts` both implement `Copy`.
- **No secrets in the repository.** Passwords are generated per test; `.env` is ignored; probe scripts redact `pass`/`token` keys.

## Accepted weaknesses

| # | Weakness | Why it stays |
|---|---|---|
| A | "No request sent" is asserted right after the errors appear, so a request fired later would be missed. | The app validates synchronously in the submit handler; a fixed wait would be the only alternative. |
| B | The page object still waits for `/api/geolocation/all` before filling. | Now stubbed in every test, so it answers immediately (D19). If the app stops calling it, `goto()` times out loudly rather than passing falsely. |
| C | I-02 only asserts "4xx and an error is shown". | The intended duplicate behaviour is an open question to nesto (C-1 in the bug reports); pinning `400` would encode a guess. |
| D | I-01a depends on a backend rule about placeholder domains. | It tests a real rejection without mocking; it will need revising if the rule changes. |
| E | Error messages pin the current "letters" wording (BUG-3). | The tests need some expected text; the hint with the typo is matched by pattern instead. |
| F | CI has run twice, on GitHub-hosted Ubuntu runners only: the first run [failed](https://github.com/sadia5055/CaseStudy_Signup_2026/actions/runs/44118433451) (findings 12–14), the next [passed all six jobs](https://github.com/sadia5055/CaseStudy_Signup_2026/actions/runs/44128638174). One green run is not a stability record. | Needs more runs over time, including at different hours. |
| G | Client-side validation only. | Server-side checks would mean bypassing the form. |
| H | Phones are Playwright emulations, not real devices; tablets, landscape and the hamburger breakpoint width are not covered. | Real devices need a device cloud; listed as the next step. A full run also creates 30 accounts in QA, so `npm run test:chrome` exists for quick runs. |

## Open

- Questions for nesto are collected in `ASSUMPTIONS.md` (A2, A4–A7) and `05-bug-reports.md` (section B).

## Skeptical Staff SDET review of the remediation

I reviewed this as a Staff SDET at nesto would, looking for what could still hurt the candidate or the company.

**Blockers before submission** (none is a code defect; all need the repository owner or nesto):

1. **The 27 artifacts with working credentials are still downloadable** by any signed-in GitHub user until they are deleted or expire (24 November and 1 December). Only the owner can delete them; the command and steps are in [07](07-security-remediation.md).
2. **Up to 132 QA accounts still have exposed passwords.** Only nesto can deactivate them. They have not been told yet. The presentation's open-points slide carries the request; it should also be in the submission email.
3. **Nothing remediated is public until it is pushed.** The public repository still holds the old workflow, the wrong D16 and the raw uploads. Until pushed, every CI run publishes raw reports.
4. **The remediated workflow has never run on GitHub.** The security job needs Chromium and the fake server on a Linux runner; the summary, gate, upload, fork guard and `contents: read` change are untested there. The first push will also create 30 QA accounts. It should be watched, and the artifact it produces opened to confirm it holds only the summary.

**What I verified and what I did not**

- Verified by measurement: the leak mechanisms; that each protection is needed (five mutations turn the test red); that a real 300-execution report holds no password, email or token; that the summary and gate are clean on dirty input; the Firefox cause (contention) with a negative result for QA latency and for the test code.
- Not verified: the GitHub artifacts themselves (no authentication); real CI behaviour of the new workflow; Firefox over many runs on a quiet machine (one clean full run is not proof, and the three original timeouts did not reproduce, so the trigger was not identified).

**Residual weaknesses (accepted, documented)**

- `PLAYWRIGHT_NO_COPY_PROMPT` is not a documented option and may change; the security test pins its effect and fails after a Playwright upgrade that breaks it.
- The three secret fields are entered with a real click and Tab around a script that fires `beforeinput`, `input` and `change`, not typed key by key. On the real form this matched real typing for errors and payload in 11 cases on three engines, and the app has no key, blur or change validation, but the suite does not prove that per-keystroke behaviour on those fields works.
- The canary test uses a fake page. It proves the helpers and fixtures do not leak, not that a future new assertion cannot; the summary-only upload and the gate are the backstop.
- Screenshots (local only) show the generated email and cannot be text-scanned.
- `captureCreation` reads the response body after the response event; an instant redirect would lose it (reproduced on the fake server). The real app's Auth0 round trip makes this safe in practice.
- Mailinator inboxes are public, so a generated address is guessable and readable by anyone until a controlled domain replaces it.

**Verdict.** The code and documentation are in a state I would defend. The submission should wait for blockers 1 to 4: delete the artifacts, tell nesto about the accounts, push, and read the first CI run.
