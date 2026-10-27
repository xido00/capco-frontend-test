import { z } from 'zod'

import type { components } from './schema'

type ErrorDocument = components['schemas']['ErrorDocument']
export type JsonApiError = ErrorDocument['errors'][number]

const errorDocumentSchema: z.ZodType<ErrorDocument> = z.object({
  errors: z
    .array(
      z.object({
        status: z.string(),
        code: z.string(),
        title: z.string(),
        detail: z.string(),
        source: z.object({ pointer: z.string() }).optional(),
      }),
    )
    .min(1),
})

/**
 * Every way an API call can fail, grouped by how the UI should react.
 * Statuses the UI cannot act on (406, 415, 5xx, unreadable bodies) are `unexpected`.
 */
export type ApiFailure =
  | { kind: 'validation'; errors: JsonApiError[] }
  | { kind: 'unauthorized'; errors: JsonApiError[] }
  | { kind: 'forbidden' }
  | { kind: 'not-found' }
  | { kind: 'conflict'; errors: JsonApiError[] }
  | { kind: 'rate-limited'; retryAfterSeconds?: number }
  | { kind: 'network' }
  | { kind: 'unexpected'; status?: number }

export class ApiError extends Error {
  constructor(readonly failure: ApiFailure) {
    super(`API request failed: ${failure.kind}`)
    this.name = 'ApiError'
  }
}

interface ClientResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/** Resolves an `apiClient` call to its data or throws an `ApiError`. */
export async function unwrap<T>(request: Promise<ClientResult<T>>): Promise<T> {
  let result: ClientResult<T>
  try {
    result = await request
  } catch (cause) {
    // openapi-fetch rethrows fetch failures; a SyntaxError means an unreadable success body.
    throw new ApiError(
      cause instanceof SyntaxError
        ? { kind: 'unexpected' }
        : { kind: 'network' },
    )
  }
  if (!result.response.ok) {
    throw new ApiError(failureFrom(result.response, result.error))
  }
  return result.data as T
}

/** Maps field errors to attribute names, keeping the first message per field. */
export function fieldErrorsByAttribute(
  errors: readonly JsonApiError[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const error of errors) {
    const attribute = error.source?.pointer.match(
      /^\/data\/attributes\/([^/]+)$/,
    )?.[1]
    if (attribute && !(attribute in fieldErrors)) {
      fieldErrors[attribute] = error.detail
    }
  }
  return fieldErrors
}

function failureFrom(response: Response, body: unknown): ApiFailure {
  switch (response.status) {
    case 400:
    case 422:
      return { kind: 'validation', errors: readErrors(body) }
    case 401:
      return { kind: 'unauthorized', errors: readErrors(body) }
    case 403:
      return { kind: 'forbidden' }
    case 404:
      return { kind: 'not-found' }
    case 409:
      return { kind: 'conflict', errors: readErrors(body) }
    case 429:
      return {
        kind: 'rate-limited',
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
      }
    default:
      return { kind: 'unexpected', status: response.status }
  }
}

function readErrors(body: unknown): JsonApiError[] {
  const parsed = errorDocumentSchema.safeParse(body)
  return parsed.success ? parsed.data.errors : []
}

function parseRetryAfter(value: string | null): number | undefined {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 1 ? seconds : undefined
}
