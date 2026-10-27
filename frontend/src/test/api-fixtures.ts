import { HttpResponse } from 'msw'

import { jsonApiMediaType } from '../api/client'

import type { components } from '../api/schema'

// Fixtures are typed with the generated contract: if the API changes and the
// types are regenerated, fixtures that no longer match fail typecheck.
type Schemas = components['schemas']

export const applicationId = '0199a8bb-8687-7c22-aed5-55d432f50f23'

export const apiPaths = {
  accounts: '/api/v1/applicant-accounts',
  sessions: '/api/v1/applicant-sessions',
  currentSession: '/api/v1/applicant-sessions/current',
  applications: '/api/v1/applicant-applications',
  currentApplication: '/api/v1/applicant-applications/current',
  form: (id = applicationId) => `/api/v1/applicant-applications/${id}/form`,
} as const

interface ResponseInit {
  status?: number
  headers?: Record<string, string>
}

export function jsonApiResponse(
  body: Schemas[keyof Schemas],
  { status = 200, headers = {} }: ResponseInit = {},
) {
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': jsonApiMediaType, ...headers },
  })
}

interface ErrorSpec {
  code: string
  detail?: string
  pointer?: string
}

/** JSON:API error document; pass a code for a single error without a pointer. */
export function errorResponse(
  status: number,
  errors: string | readonly ErrorSpec[],
  headers?: Record<string, string>,
) {
  const specs = typeof errors === 'string' ? [{ code: errors }] : errors
  const document: Schemas['ErrorDocument'] = {
    errors: specs.map(({ code, detail = 'Detail', pointer }) => ({
      status: String(status),
      code,
      title: 'Error',
      detail,
      ...(pointer ? { source: { pointer } } : {}),
    })),
  }
  return jsonApiResponse(document, { status, headers })
}

export const completeAnswers = {
  name: 'Ada Lovelace',
  dateOfBirth: '1815-12-10',
  country: 'United Kingdom',
  nationality: 'British',
  email: 'ada@example.test',
  phone: '+44 20 7946 0000',
  consentConfirmed: true,
  documentType: 'Passport',
  documentNumber: 'AL1815',
  documentCountry: 'United Kingdom',
  expiry: '2030-01-01',
  street: '12 St James Square',
  city: 'London',
  postal: 'SW1Y 4JH',
  residentialCountry: 'United Kingdom',
} satisfies Schemas['Answers']

export function formDocument({
  answers = completeAnswers,
  version = 4,
  documentPresent = false,
}: {
  answers?: Schemas['Answers']
  version?: number
  documentPresent?: boolean
} = {}): Schemas['FormDocument'] {
  return {
    data: {
      type: 'applicant-application-forms',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [],
        answers,
        documentEvidence: { present: documentPresent },
        version,
      },
    },
  }
}

export function applicationDocument(
  step: Schemas['Step'],
): Schemas['ApplicantApplicationDocument'] {
  return {
    data: {
      type: 'applicant-applications',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: step,
        href: `/applications/${applicationId}/${step}`,
        progress:
          step === 'personal-details'
            ? [
                { step: 'personal-details', state: 'current' },
                { step: 'identity-and-address', state: 'not-started' },
              ]
            : [
                { step: 'personal-details', state: 'complete' },
                { step: 'identity-and-address', state: 'current' },
              ],
      },
    },
  }
}

export function sessionDocument(
  href: string,
): Schemas['ApplicantSessionDocument'] {
  return {
    data: {
      type: 'applicant-sessions',
      id: '0199a8bb-8687-7c22-aed5-55d432f50f24',
      attributes: { href },
    },
  }
}
