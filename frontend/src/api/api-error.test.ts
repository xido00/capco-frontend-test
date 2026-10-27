import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  apiPaths,
  errorResponse,
  jsonApiResponse,
  sessionDocument,
} from '../test/api-fixtures'
import { server } from '../test/server'

import {
  ApiError,
  fieldErrorsByAttribute,
  unwrap,
  type ApiFailure,
} from './api-error'
import { createApplicantAccount } from './applicant-access'
import { apiClient, jsonApiMediaType } from './client'

const accountsPath = apiPaths.accounts
const credentials = { email: 'ada@example.test', password: 'Secret!1' }

async function failureOf(request: Promise<unknown>): Promise<ApiFailure> {
  const error: unknown = await request.catch((cause: unknown) => cause)
  expect(error).toBeInstanceOf(ApiError)
  return (error as ApiError).failure
}

describe('apiClient', () => {
  it('sends a JSON:API document with JSON:API media type headers', async () => {
    let captured: Request | undefined
    server.use(
      http.post(accountsPath, ({ request }) => {
        captured = request.clone()
        return new HttpResponse(null, { status: 201 })
      }),
    )

    await createApplicantAccount(credentials)

    expect(captured?.headers.get('Accept')).toBe(jsonApiMediaType)
    expect(captured?.headers.get('Content-Type')).toBe(jsonApiMediaType)
    expect(await captured?.json()).toEqual({
      data: { type: 'applicant-accounts', attributes: credentials },
    })
  })
})

describe('unwrap', () => {
  it('returns the response data on success', async () => {
    const session = sessionDocument('/applications/current')
    server.use(
      http.post(apiPaths.sessions, () =>
        jsonApiResponse(session, { status: 201 }),
      ),
    )

    const result = await unwrap(
      apiClient.POST('/api/v1/applicant-sessions', {
        body: { data: { type: 'applicant-sessions', attributes: credentials } },
      }),
    )

    expect(result).toEqual(session)
  })

  it('treats an unreadable success body as unexpected', async () => {
    server.use(
      http.post(
        accountsPath,
        () =>
          new HttpResponse('not json', {
            status: 201,
            headers: { 'Content-Type': jsonApiMediaType },
          }),
      ),
    )

    expect(await failureOf(createApplicantAccount(credentials))).toEqual({
      kind: 'unexpected',
    })
  })

  it.each([
    [400, 'validation'],
    [422, 'validation'],
    [401, 'unauthorized'],
    [409, 'conflict'],
  ] as const)(
    'maps %i to a %s failure with its errors',
    async (status, kind) => {
      server.use(http.post(accountsPath, () => errorResponse(status, 'code')))

      expect(await failureOf(createApplicantAccount(credentials))).toEqual({
        kind,
        errors: [expect.objectContaining({ code: 'code' })],
      })
    },
  )

  it.each([
    [403, { kind: 'forbidden' }],
    [404, { kind: 'not-found' }],
    [406, { kind: 'unexpected', status: 406 }],
    [415, { kind: 'unexpected', status: 415 }],
    [500, { kind: 'unexpected', status: 500 }],
  ] as const)('maps %i to %o', async (status, expected) => {
    server.use(http.post(accountsPath, () => errorResponse(status, 'code')))

    expect(await failureOf(createApplicantAccount(credentials))).toEqual(
      expected,
    )
  })

  it('keeps an empty error list when the error body is not a JSON:API document', async () => {
    server.use(
      http.post(
        accountsPath,
        () => new HttpResponse('Bad request', { status: 400 }),
      ),
    )

    expect(await failureOf(createApplicantAccount(credentials))).toEqual({
      kind: 'validation',
      errors: [],
    })
  })

  it.each([
    ['30', 30],
    ['soon', undefined],
  ])(
    'reads Retry-After %s when rate limited',
    async (retryAfter, retryAfterSeconds) => {
      server.use(
        http.post(
          accountsPath,
          () =>
            new HttpResponse(null, {
              status: 429,
              headers: { 'Retry-After': retryAfter },
            }),
        ),
      )

      expect(await failureOf(createApplicantAccount(credentials))).toEqual({
        kind: 'rate-limited',
        retryAfterSeconds,
      })
    },
  )

  it('reports a network failure when the request cannot be sent', async () => {
    server.use(http.post(accountsPath, () => HttpResponse.error()))

    expect(await failureOf(createApplicantAccount(credentials))).toEqual({
      kind: 'network',
    })
  })
})

describe('fieldErrorsByAttribute', () => {
  it('maps attribute pointers to the first message per field', () => {
    expect(
      fieldErrorsByAttribute([
        {
          status: '400',
          code: 'validation-failed',
          title: 'Invalid attribute',
          detail: 'Enter a valid email address.',
          source: { pointer: '/data/attributes/email' },
        },
        {
          status: '400',
          code: 'validation-failed',
          title: 'Invalid attribute',
          detail: 'Second email message.',
          source: { pointer: '/data/attributes/email' },
        },
        {
          status: '400',
          code: 'malformed-document',
          title: 'Malformed JSON:API document',
          detail: 'Not tied to a field.',
        },
      ]),
    ).toEqual({ email: 'Enter a valid email address.' })
  })
})
