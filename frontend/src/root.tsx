import { QueryClientProvider } from '@tanstack/react-query'
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

import { queryClient } from './query-client'

import type { ReactNode } from 'react'
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

/** Shown while route client loaders run on the first page load (SPA mode). */
export function HydrateFallback() {
  return (
    <main>
      <p role="status">Loading…</p>
    </main>
  )
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
