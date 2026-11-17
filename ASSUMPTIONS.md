# Assumptions

Each assumption names what it affects. Items marked **ask** are questions for nesto.

| # | Assumption | Basis | Affects |
|---|---|---|---|
| A1 | Account creation in QA with throwaway addresses is allowed and leaves accounts behind (no cleanup). | Brief: "create as many accounts as you need" | P-01, P-02, I-02; D6 |
| A2 | Validation messages and rules observed on 2026-11-16 are the intended behaviour; no spec was provided. Where a message looks wrong it is reported as a bug, not encoded as correct. | Discovery | N-01 … N-06; `05-bug-reports.md` — **ask** for a spec |
| A3 | Canada is the default phone country and the only one covered. | Discovery | N-04, P-02 |
| A4 | The consent checkbox is optional. | Submit succeeds unchecked | P-02, F-02 — **ask** (compliance intent) |
| A5 | A duplicate email returning a generic error is acceptable for now; the `400` status is recorded but not judged. | Discovery | I-02 — **ask** |
| A6 | `mailinator.com` is accepted by the backend and acceptable to nesto as a throwaway domain. | Verified: 201 for both languages | D6 — **ask** |
| A7 | Automated signups from a developer machine and from GitHub-hosted runners are acceptable; no rate limiting was observed. | ~60 submissions, no throttling | CI — **ask** |
| A8 | Desktop Chromium is sufficient for this exercise. | Brief names no browsers | D9 |
| A9 | The suite stops at the 201 response and the redirect to the quote page. Email, CRM and Auth0 behaviour are out of scope. | Scope of the brief | `02-test-strategy.md` |
| A10 | Client-side validation is what is under test. Server-side validation could not be checked without bypassing the UI. | Discovery, open question 6 | Future coverage |
