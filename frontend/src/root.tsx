import { Card, CardContent, Link, Stack, Typography } from '@kyc/ui'
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

import styles from './error-page.module.css'
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
  const title = notFound ? 'Page not found' : 'Something went wrong'
  // Rendered outside App, so DS links here do full page loads, which also
  // resets whatever state led to the error.
  return (
    <main className={styles.page}>
      <title>{`${title} – KYC`}</title>
      <Card className={styles.card}>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h1" variant="heading">
              {title}
            </Typography>
            <Typography>
              {notFound
                ? 'The page you requested does not exist.'
                : 'An unexpected error stopped this page from loading. Try again in a moment.'}
            </Typography>
            <Link href="/applications/current">Go to your application</Link>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
