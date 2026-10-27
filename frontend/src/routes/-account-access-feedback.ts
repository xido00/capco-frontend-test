import { ApiError, type ApiFailure } from '../api/api-error'

export const unexpectedErrorMessage =
  'Something went wrong on our side. Try again later.'

/** Message for failures that are not about a specific field. */
export function formLevelMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return unexpectedErrorMessage
  }
  return messageFor(error.failure)
}

function messageFor(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'rate-limited':
      return failure.retryAfterSeconds
        ? `Too many attempts. Try again in ${formatWait(failure.retryAfterSeconds)}.`
        : 'Too many attempts. Try again later.'
    case 'network':
      return 'We could not reach the server. Check your connection and try again.'
    default:
      return unexpectedErrorMessage
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`
  }
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
