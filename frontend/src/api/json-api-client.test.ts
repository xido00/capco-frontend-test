import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { server } from '../test/server'

import {
  ApiError,
  fieldErrorsByAttribute,
  jsonApiMediaType,
  jsonApiRequest,
  type ApiFailure,
} from './json-api-client'

const path = '/api/v1/example'

function errorDocument(status: number, code: string, pointer?: string) {
  return HttpResponse.json(
    {
      errors: [
        {
          status: String(status),
          code,
          title: 'Title',
          detail: `Detail for ${code}`,
          ...(pointer ? { source: { pointer } } : {}),
        },
      ],
    },
    { status, headers: { 'Content-Type': jsonApiMediaType } },
  )
}

async function failureOf(request: Promise<unknown>): Promise<ApiFailure> {
  const error: unknown = await request.catch((cause: unknown) => cause)
  expect(error).toBeInstanceOf(ApiError)
  return (error as ApiError).failure
}

describe('jsonApiRequest', () => {
  it('sends a JSON:API document with JSON:API media type headers', async () => {
    let captured: Request | undefined
    server.use(
      http.post(path, ({ request }) => {
        captured = request.clone()
        return new HttpResponse(null, { status: 201 })
      }),
    )

    await jsonApiRequest(path, {
      method: 'POST',
      body: { data: { type: 'examples' } },
      responseSchema: z.unknown(),
    })

    expect(captured?.headers.get('Accept')).toBe(jsonApiMediaType)
    expect(captured?.headers.get('Content-Type')).toBe(jsonApiMediaType)
    expect(await captured?.json()).toEqual({ data: { type: 'examples' } })
  })

  it('returns the response validated against the schema', async () => {
    server.use(http.get(path, () => HttpResponse.json({ data: { id: '1' } })))

    const result = await jsonApiRequest(path, {
      method: 'GET',
      responseSchema: z.object({ data: z.object({ id: z.string() }) }),
    })

    expect(result).toEqual({ data: { id: '1' } })
  })

  it('treats a success body that breaks the contract as unexpected', async () => {
    server.use(http.get(path, () => HttpResponse.json({ data: { id: 1 } })))

    const failure = await failureOf(
      jsonApiRequest(path, {
        method: 'GET',
        responseSchema: z.object({ data: z.object({ id: z.string() }) }),
      }),
    )

    expect(failure).toEqual({ kind: 'unexpected', status: 200 })
  })

  it.each([
    [400, 'validation'],
    [422, 'validation'],
    [401, 'unauthorized'],
    [409, 'conflict'],
  ] as const)(
    'maps %i to a %s failure with its errors',
    async (status, kind) => {
      server.use(http.post(path, () => errorDocument(status, 'some-code')))

      const failure = await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      )

      expect(failure).toEqual({
        kind,
        errors: [expect.objectContaining({ code: 'some-code' })],
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
    server.use(http.post(path, () => errorDocument(status, 'some-code')))

    expect(
      await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      ),
    ).toEqual(expected)
  })

  it('keeps an empty error list when the error body is not a JSON:API document', async () => {
    server.use(
      http.post(path, () => new HttpResponse('Bad request', { status: 400 })),
    )

    expect(
      await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      ),
    ).toEqual({
      kind: 'validation',
      errors: [],
    })
  })

  it('reads Retry-After when rate limited', async () => {
    server.use(
      http.post(
        path,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '30' },
          }),
      ),
    )

    expect(
      await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      ),
    ).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: 30,
    })
  })

  it('ignores an invalid Retry-After value', async () => {
    server.use(
      http.post(
        path,
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': 'soon' },
          }),
      ),
    )

    expect(
      await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      ),
    ).toEqual({
      kind: 'rate-limited',
      retryAfterSeconds: undefined,
    })
  })

  it('reports a network failure when the request cannot be sent', async () => {
    server.use(http.post(path, () => HttpResponse.error()))

    expect(
      await failureOf(
        jsonApiRequest(path, { method: 'POST', responseSchema: z.unknown() }),
      ),
    ).toEqual({
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
