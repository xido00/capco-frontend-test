import { useEffect, useState } from 'react'

import { ApiError } from '../api/api-error'

/**
 * Holds off resubmitting after a 429 until the API's Retry-After has passed,
 * so the button does not invite attempts that are bound to be rejected.
 */
export function useRetryAfter() {
  const [retryAt, setRetryAt] = useState<number>()

  useEffect(() => {
    if (retryAt === undefined) {
      return undefined
    }
    const timer = setTimeout(
      () => setRetryAt(undefined),
      Math.max(0, retryAt - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [retryAt])

  return {
    isWaiting: retryAt !== undefined,
    /** Starts waiting when `error` is a rate limit that says how long to wait. */
    waitIfRateLimited(error: unknown) {
      if (
        error instanceof ApiError &&
        error.failure.kind === 'rate-limited' &&
        error.failure.retryAfterSeconds
      ) {
        setRetryAt(Date.now() + error.failure.retryAfterSeconds * 1000)
      }
    },
  }
}
