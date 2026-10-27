import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { server } from './server'

// findBy* waits 1 s by default. The first test in a file also pays for
// loading React Aria and MSW, and with test files running in parallel that
// took 1.4 s once, failing a test that passes in isolation. 3 s keeps real
// failures failing while absorbing machine load.
configure({ asyncUtilTimeout: 3000 })

if (!globalThis.CSS) {
  Object.defineProperty(globalThis, 'CSS', { configurable: true, value: {} })
}

if (typeof CSS.escape !== 'function') {
  Object.defineProperty(CSS, 'escape', {
    configurable: true,
    value: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
