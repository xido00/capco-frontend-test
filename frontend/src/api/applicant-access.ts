import { unwrap } from './api-error'
import { apiClient } from './client'

export interface ApplicantCredentials {
  email: string
  password: string
}

/** Registers an Applicant account. Does not sign the Applicant in. */
export async function createApplicantAccount(
  credentials: ApplicantCredentials,
): Promise<void> {
  await unwrap(
    apiClient.POST('/api/v1/applicant-accounts', {
      body: { data: { type: 'applicant-accounts', attributes: credentials } },
    }),
  )
}
