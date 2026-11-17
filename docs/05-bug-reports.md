# 05 — Bug reports

Environment for all items: `https://app.qa.nesto.ca`, desktop Chromium, observed 2026-11-16. Section A items were reproduced directly on the page; section B items are behaviour that may be intentional and need an answer from nesto.

The automated tests pin current messages where a message is needed for a check (for example "Minimum of 12 letters required"). They do not pin text that looks wrong: the FR password hint is matched by pattern, so fixing the typo will not break the suite.

## A. Confirmed defects (all low severity)

### BUG-1 — French password hint has a grammar error

- **Preconditions:** none.
- **Steps:** open `/fr/signup`; read the hint under "Mot de passe".
- **Actual:** "Le mot de passe doit contenir **au entre** 12 et 32 caractères et contenir au moins une lettre majuscule, une lettre minuscule et un chiffre."
- **Expected:** "Le mot de passe doit contenir entre 12 et 32 caractères…" (the English hint reads "must be between 12 and 32 characters").
- **Evidence:** page text on 2026-11-16; covered by F-03 (matches the numbers and rule words, not the typo).
- **Severity:** Low. The meaning is still clear, but it is the sentence people read when their password is rejected, on a French-language page where French parity is a legal expectation.

### BUG-2 — English page title on the French quote page after signup

- **Preconditions:** a new account created from `/fr/signup`.
- **Steps:** submit a valid French signup; wait for the redirect.
- **Actual:** URL `/getaquote/fr`, heading "Comment peut-on vous aider avec votre hypothèque?", document title **"Get A Quote"**.
- **Expected:** a French title, as on the signup page ("nesto | Enregistrement").
- **Evidence:** discovery capture of the FR signup (title read after redirect). Not asserted by the suite, because the quote page is out of scope.
- **Severity:** Low. Affects browser tabs, history and screen readers, not the flow.

### BUG-3 — Password length messages say "letters" for a rule about characters

- **Preconditions:** none.
- **Steps:** submit with password `Abcdefghi12` (11 characters, 9 letters), then with a 33-character password.
- **Actual:** "Minimum of 12 letters required" / "Maximum of 32 letters required" (FR: "lettres requises"). The hint under the field says "characters".
- **Expected:** "characters" / "caractères", consistent with the hint. Digits and symbols count towards the limit, so "letters" misdescribes the rule.
- **Evidence:** validation probe, both languages; tests N-05a, N-05b pin the current text.
- **Severity:** Low. A user with 12 characters that include digits can wonder why "letters" are missing.

### BUG-4 — "British-Columbia" in the English province list

- **Steps:** open `/signup`, open "Province of purchase".
- **Actual:** "British-Columbia". **Expected:** "British Columbia" (the French label "Colombie-Britannique" is correct).
- **Evidence:** option list read on 2026-11-16.
- **Severity:** Trivial (copy).

## B. Needs clarification (not logged as defects)

| # | Observation | Question for nesto |
|---|---|---|
| C-1 | Signing up with an email that already exists returns `400 {"error":"bad format","description":"error creating account"}` and the generic "Something went wrong" message. | Is the generic message deliberate (avoids revealing which emails are registered)? If so, is `400 bad format` the intended status, or should it be `409`? Test I-02 only asserts "4xx, not created, error shown". |
| C-2 | The consent checkbox is worded about sharing information with **partners**. Checking it sends `leadDistributeConsentAgreement: true` and `emailConsent: true`, but `partnerAgreement` stays `false`; the response contains the first flag only. | Which field records which consent? Is `emailConsent` meant to be stored and returned? |
| C-3 | The French consent text adds "si nous ne sommes pas en mesure de vous fournir nos services"; the English text does not. | Is the French wording the legally reviewed one, and should English match? |
| C-4 | The hidden field `createdAt` is submitted as `"LOGIN"` and returned as `account.createdAt: "LOGIN"`, while the real creation time is `account.created`. | Is `createdAt` a source/origin label that was misnamed? |
| C-5 | The FR page logo links to `/`, same as EN; the FR "Connectez-vous" link goes to `/fr`. | Does `/` redirect French visitors to `/fr`? Not checked. |
| C-6 | An empty phone number shows "Invalid value" rather than "required". | Intended wording? |
| C-7 | Email domain `example.com` is rejected with `422 placeholder email detected`. | Expected behaviour; recorded because it forced the choice of a throwaway domain (D6). Is `mailinator.com` acceptable to nesto? |
