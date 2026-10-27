import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { RouterProvider } from 'react-aria-components'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useHref,
  useNavigate,
  useRouteError,
  type NavigateOptions,
} from 'react-router'

import { ApiError } from './api/api-error'
import './styles.css'

declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NavigateOptions
  }
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetryQuery },
          mutations: { retry: false },
        },
      }),
  )
  const navigate = useNavigate()
  return (
    <QueryClientProvider client={queryClient}>
      {/* DS links (React Aria) navigate client-side instead of reloading the app. */}
      <RouterProvider
        navigate={(href, options) => void navigate(href, options)}
        useHref={useHref}
      >
        <Outlet />
      </RouterProvider>
    </QueryClientProvider>
  )
}

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

export function ErrorBoundary() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <main>
      <h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p>
        {notFound
          ? 'The page you requested does not exist.'
          : 'Please try again.'}
      </p>
    </main>
  )
}
