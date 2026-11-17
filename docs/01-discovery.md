# 01 — Discovery

Explored `https://app.qa.nesto.ca/signup` on 2026-11-16 with Playwright (Chromium) and the browser DevTools network view. Probe scripts are in [`scripts/`](../scripts) and are not part of the test suite. Everything below was observed; anything that was not is listed under *Open questions*.

Accounts created during discovery: 2 (`id` 1065672 EN, 1065673 FR), both throwaway addresses. Passwords were generated at run time and never written down. Tokens returned by the API are redacted in all notes and scripts.

## Observed behaviour

**Language.** Encoded in the URL: `/signup` is English, `/fr/signup` is French. `<html lang>` and the page title follow it. The `FR` link in the header navigates to the French URL. The language is sent to the API (`language` in the request, `preferredLanguage` in the response).

**Validation timing.** Errors appeared after submit. Tabbing out of empty First name and Last name did not flag them; other fields were not checked for blur behaviour. Errors render under the field (`aria-invalid="true"`, `aria-describedby` → message element). Native `required` is not used.

**Success.** `POST /api/accounts` returns 201, the browser is redirected to `/getaquote` (`/getaquote/fr` in French) and the user is logged in through Auth0 (auth cookies set). No email-verification step is shown.

**Backend failure.** Any rejected request shows one generic localized message and stays on the signup page:
EN `Something went wrong! Please try again and if you continue to have trouble feel free to contact your advisor` /
FR `Quelque chose n'a pas fonctionné! Veuillez réessayer et si vous avez toujours des problèmes, n'hésitez pas à contacter votre conseiller`.
The same message appears when the request is aborted at network level.

### Form inventory

Test ids use the `data-testid` attribute (Playwright default). Field ids (`field-2`, …) are generated and not stable.

| Field | Control | `name` | `data-testid` | Label EN / FR | Notes |
|---|---|---|---|---|---|
| First name | text | `firstName` | `first-name-input` | First name / Prénom | |
| Last name | text | `lastName` | `last-name-input` | Last name / Nom | |
| Phone country | select | `phoneCountry` | — | `aria-label` "Phone number country" | default Canada; includes "International" |
| Phone | tel | `phone` | `phoneInput` | Phone number / Téléphone | input reformats while typing |
| Province | select | — | `region-select` | Province of purchase / Province de l'achat | default Ontario, 13 options + placeholder |
| Email | text (not `type=email`) | `email` | `email-input` | Email / Courriel | |
| Password | password | `password` | `password-input` | Password / Mot de passe | hint below the field, `autocomplete=off` |
| Confirm password | password | `passwordConfirmation` | `passwordConfirmation-input` | Confirm password / Confirmation du mot de passe | |
| Consent | checkbox | `leadDistributeConsentAgreement` | `agreement-checkbox` | "…contacted by nesto's partners…" | unchecked by default |
| Hidden | hidden | `createdAt` | — | — | value is sent as `createdAt: "LOGIN"` |
| Submit | button | — | `submit-button` | Create your account / Créez votre compte | |

Other elements: `FR`/`EN` toggle, `Login` link, Terms of Service link (`terms-link`), Privacy Policy link. Every input has a `<label for>` bound to its id, so label-based locators work.

Password hint (EN): *Password must be between 12 and 32 characters and contain one uppercase letter, one lowercase letter and one number.*

### Validation results (submit, EN message / FR message)

All cases ran in both languages with the creation request aborted so no account was created. The probe waits for hydration and verifies values before submitting.

| Input | Field error (EN) | Request sent |
|---|---|---|
| everything empty | first/last name "The field is required"; phone "Invalid value"; email "Invalid email"; password "Minimum of 12 letters required" | no |
| first name = spaces | "The field is required" | no |
| first name = `12345` | "Invalid name" | no |
| email `plainaddress`, `user@domain`, `user@@example.com` | "Invalid email" | no |
| phone `123`, `abcdefghij`, `1234567890` | "Invalid value" | no |
| phone `(514) 555-0123` | accepted | yes, as `+15145550123` |
| password 11 chars | "Minimum of 12 letters required" | no |
| password 33 chars | "Maximum of 32 letters required" | no |
| password without upper / lower / digit | "Password must contain at least one uppercase letter, one lowercase letter and one number" | no |
| confirmation differs or empty | "Passwords do not match" | no |
| valid, consent unchecked | accepted | yes |

French messages are present for every case: `Ce champ est obligatoire.`, `Valeur invalide.`, `Courriel invalide`, `Nom invalide`, `Minimum de 12 lettres requises`, `Maximum de 32 lettres requises`, `Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre`, `Les mots de passe ne correspondent pas`.

Consent is optional: submitting without it creates the request with `leadDistributeConsentAgreement: false`.

## Network interaction

Only one application endpoint is involved in signup.

| | |
|---|---|
| Endpoint | `POST https://app.qa.nesto.ca/api/accounts` |
| Request headers | `content-type: application/json`, tracing headers (`x-datadog-*`, `x-request-id`). No CSRF token, no captcha token, no auth header. |
| Success | `201` `{ "account": {…}, "token": {…} }` |
| Placeholder email domain (`example.com`) | `422` `{"error":"invalid parameters","parameters":["placeholder email detected"]}` |
| Existing email | `400` `{"error":"bad format","description":"error creating account"}` |
| Other traffic | `GET /api/geolocation/all`, Datadog RUM telemetry (third party). Neither is part of account creation. |

### Form → request → response

| Form value | Request field | Response field | Observation |
|---|---|---|---|
| First name | `firstName` | `account.firstName` | identical |
| Last name | `lastName` | `account.lastName` | identical |
| Email | `email` | `account.email`, `account.identityId` | identical |
| Phone (`5145550123`) | `phone` = `+15145550123` | `account.phone` = `+15145550123` | normalised to E.164 on the client |
| Province | `region`, `cfProvince` | `account.region` | code (`QC`), not the label |
| URL language | `language` (`en`/`fr`) | `account.preferredLanguage` | identical |
| Consent checkbox | `leadDistributeConsentAgreement`, `emailConsent` | `account.leadDistributeConsentAgreement` | `emailConsent` is not in the response; `partnerAgreement` stays `false` |
| Password | `password`, `passwordSpecified` | — | **not echoed** |
| hidden `createdAt` | `createdAt: "LOGIN"` | `account.createdAt: "LOGIN"` | field named `createdAt` holds a source label |

Server-generated: `account.id`, `account.rid`, `account.created`, `account.updated`, `account.role` (`borrower`), `account.tenant`, and `token.*` (access token, refresh token, expiry — secrets, never stored).
The request also carries tracking fields (`anonymousAccountId`, `gaClientId`, `utm*`, `marketingChannel`, `formName`). They vary per session and are not asserted.

## Technical constraints

- **Hydration race.** The form is a Next.js page. Filling fields before hydration drops values (seen as unrelated "required" errors in the first probe run). Tests need a hydration signal before filling.
- **Phone input reformats** what is typed, so assertions on the field value must compare digits, not the raw string.
- **Disposable email domain.** `example.com` is rejected server-side ("placeholder email detected"). A real-looking throwaway domain is needed; discovery used `mailinator.com` with generated local parts. Public inboxes are readable by anyone, so tests send only fake names and numbers.
- **No cleanup route** is known; every run leaves accounts in QA (allowed by the assessment).
- **No rate limiting or bot protection** was hit in roughly 60 form submissions. This says nothing about GitHub-hosted runners.
- **Token lifetime** is 10 minutes (`expires` − `created`); irrelevant to the tests, relevant to what must not be stored.

## Open questions

1. Is a duplicate email meant to return `400 bad format` with the generic message, or `409` with an explicit message? (Enumeration protection would justify the generic message, not the status.)
2. Why does the consent checkbox about *partners* set `emailConsent: true` while `partnerAgreement` stays `false`, and why is `emailConsent` absent from the response?
3. Does the French consent text, which adds "si nous ne sommes pas en mesure de vous fournir nos services", match the English legal meaning?
4. Is there a documented phone rule for non-Canadian countries? Only Canada (default) was explored.
5. Which browsers and viewports are supported? Only desktop Chromium was used.
6. Is the endpoint callable without a browser session? Not tested; server-side validation parity is therefore not covered (see `02-test-strategy.md`).

## Observed issues versus potential risks

**Observed (reproducible):**

| # | Observation | Severity guess |
|---|---|---|
| 1 | FR password hint reads "doit contenir **au entre** 12 et 32 caractères" | Low (copy) |
| 2 | Page title after signup is "Get A Quote" on `/getaquote/fr` (English title on French page) | Low (i18n) |
| 3 | Messages say "12 **letters**" / "32 letters" for a rule about characters (digits count too); same in FR "lettres" | Low (copy) |
| 4 | Province "British-Columbia" (hyphen) in EN | Trivial (copy) |
| 5 | EN and FR consent text differ in meaning (open question 3) | Needs clarification, potentially legal |
| 6 | Duplicate email returns `400 bad format` (open question 1) | Needs clarification |
| 7 | Hidden field `createdAt` carries the value `LOGIN` (open question: naming/contract) | Needs clarification |
| 8 | FR logo links to `/` (same as EN) while the FR "Connectez-vous" link goes to `/fr`; `/` may redirect by locale, not checked | Needs clarification |

Details, evidence and severity rationale: [`05-bug-reports.md`](05-bug-reports.md).

**Potential risks, not tested:** server-side validation if the client is bypassed; concurrent duplicate submissions; double-click on submit; behaviour for non-Canadian phone countries; accessibility beyond label/`aria-invalid` semantics; mobile viewport; email case normalisation (`A@B.com` vs `a@b.com`).
