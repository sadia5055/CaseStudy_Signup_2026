import { z } from 'zod';

/**
 * Contract for the 201 body of POST /api/accounts: only what the tests rely on.
 * `loose()` keeps the ~60 other account fields (tracking, `*Specified` flags) from failing the check;
 * see decision D5. The "no password echoed" rule is asserted separately (redact.ts).
 */
export const CreationResponse = z.object({
  account: z
    .object({
      id: z.number().int().positive(),
      role: z.literal('borrower'),
      email: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().regex(/^\+\d{8,15}$/),
      preferredLanguage: z.enum(['en', 'fr']),
      region: z.string().min(2),
      leadDistributeConsentAgreement: z.boolean(),
      partner: z.string().min(1),
      disabled: z.literal(false),
      deleted: z.literal(false),
      created: z.iso.datetime(),
    })
    .loose(),
  token: z.object({ accessToken: z.string().min(1), expires: z.iso.datetime() }).loose(),
});

export type CreationResponse = z.infer<typeof CreationResponse>;
