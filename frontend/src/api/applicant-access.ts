import { z } from 'zod'

import { jsonApiRequest } from './json-api-client'

export interface ApplicantCredentials {
  email: string
  password: string
}

/** Registers an Applicant account. Does not sign the Applicant in. */
export async function createApplicantAccount(
  credentials: ApplicantCredentials,
): Promise<void> {
  await jsonApiRequest('/api/v1/applicant-accounts', {
    method: 'POST',
    body: { data: { type: 'applicant-accounts', attributes: credentials } },
    responseSchema: z.unknown(),
  })
}
