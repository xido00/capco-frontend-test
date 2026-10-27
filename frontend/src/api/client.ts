import createClient from 'openapi-fetch'

import type { paths } from './schema'

export const jsonApiMediaType = 'application/vnd.api+json'

/** Typed client for the backend contract in `public/openapi.json`. */
export const apiClient = createClient<paths>({
  // Same-origin API; Node (tests, prerender) cannot resolve relative URLs.
  baseUrl: typeof window === 'undefined' ? '' : window.location.origin,
  headers: { Accept: jsonApiMediaType },
  // Resolve fetch per call: openapi-fetch otherwise captures it at import time,
  // before test interceptors (MSW) install, and requests would hit a live server.
  fetch: (request) => globalThis.fetch(request),
})

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

apiClient.use({
  onRequest({ request }) {
    // openapi-fetch sends JSON bodies as application/json; the API requires JSON:API.
    if (request.headers.get('Content-Type') === 'application/json') {
      request.headers.set('Content-Type', jsonApiMediaType)
    }
    // Authenticated writes must echo the XSRF-TOKEN cookie set at sign-in.
    const csrfToken = readCookie('XSRF-TOKEN')
    if (csrfToken && !safeMethods.has(request.method)) {
      request.headers.set('X-XSRF-TOKEN', csrfToken)
    }
    return request
  },
})

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const prefix = `${name}=`
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
}
