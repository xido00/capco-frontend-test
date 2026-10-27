import { unwrap } from './api-error'
import { apiClient } from './client'

import type { components } from './schema'

type Schemas = components['schemas']

export type ApplicationStep = Schemas['Step']
export type ApplicationAnswers = Schemas['Answers']
export type CurrentApplication = Schemas['ApplicantApplicationDocument']['data']
export type ApplicationForm = Schemas['FormResource']
export type ApplicationFormUpdate = Schemas['FormUpdateAttributes']

/** The signed-in Applicant's draft, or `null` when none has been started. */
export async function getCurrentApplication(
  signal?: AbortSignal,
): Promise<CurrentApplication | null> {
  const document = await unwrap(
    apiClient.GET('/api/v1/applicant-applications/current', { signal }),
  )
  return document?.data ?? null
}

/** Starts a draft, or returns the existing one; repeated calls are safe. */
export async function startApplication(): Promise<CurrentApplication> {
  const document = await unwrap(
    apiClient.POST('/api/v1/applicant-applications'),
  )
  return document.data
}

export async function getApplicationForm(
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicationForm> {
  const document = await unwrap(
    apiClient.GET('/api/v1/applicant-applications/{applicationId}/form', {
      params: { path: { applicationId } },
      signal,
    }),
  )
  return document.data
}

/** Saves one step's answers; `version` guards against overwriting newer changes. */
export async function saveApplicationForm(
  applicationId: string,
  attributes: ApplicationFormUpdate,
): Promise<ApplicationForm> {
  const document = await unwrap(
    apiClient.PATCH('/api/v1/applicant-applications/{applicationId}/form', {
      params: { path: { applicationId } },
      body: {
        data: {
          type: 'applicant-application-forms',
          id: applicationId,
          attributes,
        },
      },
    }),
  )
  return document.data
}

/** Revokes the session; the API clears the session cookie. */
export async function signOut(): Promise<void> {
  await unwrap(apiClient.DELETE('/api/v1/applicant-sessions/current'))
}
