# 07 — Security remediation: credentials in test reports

## Summary

A pre-publication audit found that the Playwright reports uploaded by CI contained the generated account passwords. This happened on **every** run, passing or failing, not only on failures as `D16` first claimed. The reports are now no longer uploaded, the data no longer enters Playwright's output, a regression test (`npm run test:security`) proves it with canary credentials, and CI publishes only an allowlisted summary.

The accounts involved are throwaway QA accounts holding fake data. No token, cookie or authorization header was found in any artifact, and no report or artifact was ever committed to git.

## Root cause

Measured on Playwright 1.65.1 with synthetic canary values (a lab with one scenario per mechanism; values never printed):

| Mechanism | Result |
|---|---|
| `locator.fill(value)` | The value is rendered into the step title (`Fill "<value>"`), in the HTML report, for passing and failing tests. `type` and the keyboard methods do the same. |
| `fill` inside `test.step(..., { box: true })` | **Still leaks.** A boxed step does not hide the inner step titles. |
| Failure snapshot | On a failed test Playwright copies the page, including typed field values, into `error-context.md` and the report. There is no documented option to mask it. |
| `expect(...).toHaveValue(secret)`, `toMatchObject` on an object holding the email | The values are printed in the error text, the JSON report, the console and the HTML report. |
| Attachment containing the raw exchange | The generated email, names, phone and ids appear in the report. |
| `locator.evaluate(fn, value)` | The step title is `Evaluate`; the argument is not rendered. **Clean.** |
| `PLAYWRIGHT_NO_COPY_PROMPT=1` | Playwright skips the page snapshot (verified: the `# Page snapshot` section disappears). Present in the Playwright source, **not a documented option**. |
| Comparing booleans or field names in assertions; allowlisted attachments | **Clean.** |

The earlier statement in `D16` that only failing tests were affected was wrong: the password reaches the report through step titles before any failure occurs.

## Exposure scope

| Item | Detail |
|---|---|
| Where | The HTML report (`playwright-report`) uploaded with `if: always()`; `error-context.md` and screenshots in the failure artifact |
| When | 2026-11-17, CI runs 1, 2, 3, 5 (cancelled early) and 6, from about 15:50 to 19:40 UTC |
| How much | 27 artifacts (22 report artifacts, 5 failure artifacts), about 8 MB. Each report holds the passwords of the accounts created by its jobs |
| Affected QA accounts | At most **132**: 22 report artifacts × 2 projects × 3 account-creating tests (P-01, P-02, I-02). Fewer if a test failed before the account was created |
| Who could read it | Any signed-in GitHub user, while the artifacts exist: the repository is public, downloads need a login (an unauthenticated request gets HTTP 401). Retention was 14 days (reports) and 7 days (failure artifacts) |
| Also public | The page of failed run 1 shows the Auth0 login URL with the application's `client_id` and the QA host names in its failure annotations. A client id is a public identifier by design; recorded for completeness |
| Not exposed | Tokens (the `token` object was redacted in every attached exchange), cookies, authorization headers, traces, video. No report or artifact was ever committed to git (18 commits scanned) |

**Audit limits.** GitHub artifacts and raw job logs need authentication, so they could not be opened. The exposure was established by reproducing the same code and configuration in a scratch copy and scanning the resulting files. The artifact sizes are consistent with that reproduction, but the artifacts themselves were not inspected. Screenshots are images and were reviewed by eye, not text-scanned: they show the generated email in clear and the password as dots.

## Containment

Done:

- CI no longer uploads raw reports or `test-results` (commit `ci: stop uploading raw Playwright reports`). This takes effect when the change is pushed.

For the repository owner (not done by the assistant: it cannot authenticate, and deletion is destructive):

1. **Delete the existing artifacts.** Repository → Actions → open each run → Artifacts → delete, or with a token that has Actions write access:

   ```bash
   gh api --paginate repos/sadia5055/CaseStudy_Signup_2026/actions/artifacts --jq '.artifacts[].id' \
     | xargs -I{} gh api -X DELETE repos/sadia5055/CaseStudy_Signup_2026/actions/artifacts/{}
   ```

2. **Shorten retention** under Settings → Actions → General while any artifact policy is reviewed. Optionally delete workflow run 1: its public failure annotations show the Auth0 login URL with the client id.
3. **Ask nesto to deactivate the affected accounts.** They can be identified without any credential: the address starts with `qa.auto.` and ends `@mailinator.com`, created on 2026-11-17 in the windows above. The suite cannot reset or delete them, and a password reset would go to a public mailbox, so only nesto can invalidate them. The assistant did not log in to, reset or modify any account.
4. **Use an address domain nesto controls** for future runs (`EMAIL_DOMAIN`), because mailinator inboxes are readable by anyone.

## The fix

Source (`fix(test)`):

- The generated email and the passwords are entered with `evaluate`, under a step named after the field only ("Enter password (value not recorded)").
- The retry check compares booleans, so no value reaches an error message. Assertions report field names, not objects (`mismatchedFields`), instead of `toMatchObject`.
- The attached exchange is an allowlisted projection (status, field names, closed-list values such as language and province, booleans). It replaces denylist redaction: nothing needs to be removed because nothing sensitive is copied.
- `PLAYWRIGHT_NO_COPY_PROMPT=1` is set in `playwright.config.ts`, so no page snapshot is written.
- The redirect check after signup prints the path only (`SignupPage.expectToLandOn`). `toHaveURL` prints the full URL, and the app's OAuth login URLs carry `code`, `state` and client ids.

CI (`ci`):

- The JSON report stays on the runner. `scripts/summarize-results.mjs` builds the only published file from an allowlist: test titles, project, outcome, duration, attempts, totals and tool versions.
- `security/upload-gate.mjs` fails the job if the summary contains anything shaped like a generated password or email, a token, a cookie, a client id or a local path.
- `permissions: contents: read`; checkout without persisted credentials; pull requests from forks skip the QA tests; the QA tests start only after the security job passes.

## Verification

`npm run test:security` (about 25 seconds, no QA accounts, no network) pushes synthetic canary credentials through the real fixtures, page object and helpers against a local fake signup server, using the same reporters as CI, with passing and deliberately failing scenarios. It scans the HTML report (including its embedded zip), JSON report, console output, `error-context.md` files and attachments for each canary as raw text, JSON-escaped, URL-encoded and base64, and fails if one is found. It never prints a canary.

Controls, so that a clean result means something:

- a scanner self-test (canaries hidden in plain, escaped, encoded, zipped and nested-zip forms must be found);
- a leaky run that must be detected in the HTML report, the JSON report and the console;
- the summary is built from that dirty run's results and must still be clean.

Mutation checks, each of which turned the test red: reverting to a plain `fill`; removing the snapshot suppression; attaching the raw exchange; making the allowlist copy the email; going back to `toHaveURL` (the auth-code canary then appeared in the console, HTML report, JSON report and `error-context.md`).

A real run (Chrome and the Safari engine, English and French, 60 tests, 6 real accounts) produced an HTML report with no generated password and no email.

## Input fidelity: does `evaluate` behave like a real user?

The signup assessment tests validation, so entering the email and passwords through `evaluate` must not bypass anything the tests are meant to verify. Checked on the **real QA form** in Chromium, Firefox and WebKit, with the signup request aborted so no account was created (synthetic values; only booleans and counts recorded). Four input methods were compared against real keystroke typing (`pressSequentially`): `fill`, the first version of this fix (focus, native setter, one `input` event), and the version now in the code (real click, `beforeinput`/`input`/`change`, real Tab).

**Events on the email field** (identical on all three engines):

| Method | What fires |
|---|---|
| Real typing | pointer, focus, click, then per character `keydown`, `keypress`, `beforeinput`, `input`, `keyup` (31 each), then `change`, `blur` |
| `fill` | focus, one `beforeinput`, one `input`, `change`, `blur` |
| First version of the fix | focus and **one synthetic `input`** only: no click, no `change`, no `blur`, no key events |
| Version in the code | real pointer, focus, click and Tab (trusted focus and blur); synthetic `beforeinput`, `input`, `change` |

**Behaviour**, 11 cases (valid, empty, three malformed emails, four password rules, two confirmation cases) on each engine:

- the validation errors were identical to real typing for every method and every case;
- the request payload carried the intended email and password for every method (React state updates correctly);
- the app does not validate on blur or change at all (no error appeared before submit with real typing), so skipping those events changed nothing observable.

**What is still not reproduced.** The per-keystroke events (`keydown`, `keypress`, `keyup`) and the browser's own trusted `input` events. They cannot be produced without passing the value to a Playwright call that renders it into the report. The application showed no dependence on them (no per-key handlers, no blur or change validation), but if it ever adds key-driven behaviour to these three fields the suite would not exercise it. The names, phone and other fields are still typed with `fill`.

## Is there a supported way to keep typed values out of the failure snapshot?

Measured with canary values, four configurations of the same failing scenarios:

| Configuration | Page snapshot in `error-context.md` | Canary in the report's error context |
|---|---|---|
| Neither | present | leaks |
| HTML reporter option `noCopyPrompt` (typed in `test.d.ts`, added in Playwright 1.56) | present | **leaks (identical to "neither")** |
| `PLAYWRIGHT_NO_COPY_PROMPT=1` | absent | clean |
| Both | absent | clean |

The supported option only hides the report's "Copy prompt" feature; it does not stop the runner from capturing the snapshot. The variable that does is a runner-side variable that is not in Playwright's documentation (a web search found no official page for it; it is visible only in the source). Taking the snapshot happens right after the test function fails and before any `afterEach` hook or fixture teardown, so a hook cannot clear the fields first. No supported mechanism was found.

So the variable is **one layer of five, not the only protection**:

1. raw reports, `test-results` and screenshots are never uploaded from CI (the main protection: nothing is published);
2. the published summary is built from an allowlist and checked by the upload gate;
3. the source never passes secrets to value-rendering calls and never prints values in assertions;
4. the attached exchange is an allowlist;
5. `PLAYWRIGHT_NO_COPY_PROMPT=1`, which protects local reports and `test-results`.

If a Playwright upgrade stops honouring the variable, the security test fails (verified by removing it: the canary then appears in `error-context.md` and the report). The version it was verified against is the locked one, 1.65.1; `package.json` allows `^1.65.1`, so `npm update` could move it, and the lockfile and `npm ci` are what hold it in CI.

## Latest results

Final code, full matrix on a Windows laptop (started 2026-11-17 22:28 UTC): **300/300 executions passed, 0 failed, 0 flaky, 0 retried, in 8 min 23 s (2 workers, CPU average 59%, slowest execution 11.1 s against the 60 s limit; Firefox median 3.1 s, p90 6.3 s)**.

Security: `npm run test:security` passes (six scenarios, scanner self-test, leaky control, five mutations detected). The raw JSON report of a real 300-execution run, with 30 real accounts, held no password, email or token; the only credential-shape finding was the local absolute path of that machine, which is why raw reports are not uploaded. The summary built from it passes the upload gate.

Not yet verified: the remediated workflow (security job, summary, upload gate, fork guard, `contents: read`) has not run on GitHub. See the review.

## Remaining limitations

- `PLAYWRIGHT_NO_COPY_PROMPT` is not a documented option. `npm run test:security` pins its effect, so a Playwright upgrade that changes it fails the test. Other Playwright versions may also change what titles render.
- Screenshots (failure only, local only) show the generated email. They are not uploaded and cannot be text-scanned.
- The email and the two password fields are not typed key by key (see *Input fidelity*): no per-keystroke events and no trusted `input` events. The fill-and-verify loop still asserts the value stayed, and a real click and Tab frame it.
- `captureCreation` reads the response body after the response event. If the page navigated away immediately the body would be gone; the real app's Auth0 round trip is slow enough that this has not happened. The fake server reproduced it with an instant redirect.
- The artifacts already published stay downloadable until deleted by the owner.
