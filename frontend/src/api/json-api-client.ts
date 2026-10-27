import { z } from 'zod'

export const jsonApiMediaType = 'application/vnd.api+json'

const jsonApiErrorSchema = z.object({
  status: z.string(),
  code: z.string(),
  title: z.string(),
  detail: z.string(),
  source: z.object({ pointer: z.string() }).optional(),
})

const errorDocumentSchema = z.object({
  errors: z.array(jsonApiErrorSchema).min(1),
})

export type JsonApiError = z.infer<typeof jsonApiErrorSchema>

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

interface JsonApiRequestOptions<T> {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Validates the success body; use `z.unknown()` for responses without content. */
  responseSchema: z.ZodType<T>
}

export async function jsonApiRequest<T>(
  path: string,
  { method, body, responseSchema }: JsonApiRequestOptions<T>,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: {
        Accept: jsonApiMediaType,
        ...(body === undefined ? {} : { 'Content-Type': jsonApiMediaType }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError({ kind: 'network' })
  }

  if (!response.ok) {
    throw new ApiError(await failureFrom(response))
  }
  const parsed = responseSchema.safeParse(await readJson(response))
  if (!parsed.success) {
    throw new ApiError({ kind: 'unexpected', status: response.status })
  }
  return parsed.data
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

async function failureFrom(response: Response): Promise<ApiFailure> {
  switch (response.status) {
    case 400:
    case 422:
      return { kind: 'validation', errors: await readErrors(response) }
    case 401:
      return { kind: 'unauthorized', errors: await readErrors(response) }
    case 403:
      return { kind: 'forbidden' }
    case 404:
      return { kind: 'not-found' }
    case 409:
      return { kind: 'conflict', errors: await readErrors(response) }
    case 429:
      return {
        kind: 'rate-limited',
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
      }
    default:
      return { kind: 'unexpected', status: response.status }
  }
}

async function readErrors(response: Response): Promise<JsonApiError[]> {
  const parsed = errorDocumentSchema.safeParse(await readJson(response))
  return parsed.success ? parsed.data.errors : []
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 1 ? seconds : undefined
}
