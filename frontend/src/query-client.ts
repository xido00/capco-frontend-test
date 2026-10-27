import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './api/api-error'

/**
 * One client for the browser session, shared by route loaders and components
 * so a loader's fetch fills the cache a page then reads. A module-level client
 * is safe here: the app runs in SPA mode (no server rendering across users).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryQuery },
    mutations: { retry: false },
  },
})

/**
 * Retries only failures a retry can fix (network, 5xx). Client errors such as
 * an expired session (401) are shown immediately instead of after retries.
 */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
  const transient =
    !(error instanceof ApiError) ||
    error.failure.kind === 'network' ||
    (error.failure.kind === 'unexpected' &&
      (error.failure.status ?? 500) >= 500)
  return transient && failureCount < 2
}
