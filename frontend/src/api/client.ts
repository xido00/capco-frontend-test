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

apiClient.use({
  onRequest({ request }) {
    // openapi-fetch sends JSON bodies as application/json; the API requires JSON:API.
    if (request.headers.get('Content-Type') === 'application/json') {
      request.headers.set('Content-Type', jsonApiMediaType)
    }
    return request
  },
})
