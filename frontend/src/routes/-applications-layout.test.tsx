import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createRoutesStub } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { queryClient as sharedQueryClient } from '../query-client'
import { apiPaths } from '../test/api-fixtures'
import { server } from '../test/server'

import ApplicationsLayout, { clientLoader } from './applications'

const sessionPath = apiPaths.currentSession

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  queryClient.setQueryData(['applications', 'current'], { id: 'cached' })
  const Stub = createRoutesStub([
    {
      path: '/applications',
      Component: ApplicationsLayout,
      children: [{ path: 'current', Component: () => <p>Journey page</p> }],
    },
    { path: '/sign-in', Component: () => <p>Sign-in page</p> },
  ])
  render(
    <QueryClientProvider client={queryClient}>
      <Stub initialEntries={['/applications/current']} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), queryClient }
}

describe('Applications layout', () => {
  it.each([
    ['revoked', () => new HttpResponse(null, { status: 204 })],
    ['already expired', () => new HttpResponse(null, { status: 401 })],
  ])(
    'signs out when the session is %s and forgets cached answers',
    async (_, response) => {
      server.use(http.delete(sessionPath, response))
      const { user, queryClient } = renderLayout()

      await user.click(screen.getByRole('button', { name: 'Sign out' }))

      expect(await screen.findByText('Sign-in page')).toBeInTheDocument()
      expect(
        queryClient.getQueryData(['applications', 'current']),
      ).toBeUndefined()
    },
  )

  it('stays signed in and explains when signing out fails', async () => {
    server.use(http.delete(sessionPath, () => HttpResponse.error()))
    const { user } = renderLayout()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you out.',
    )
    expect(screen.getByText('Journey page')).toBeInTheDocument()
  })
})

describe('Applications session guard', () => {
  const currentPath = apiPaths.currentApplication

  afterEach(() => sharedQueryClient.clear())

  function load(url: string) {
    return clientLoader({
      request: new Request(`http://localhost${url}`),
    } as Parameters<typeof clientLoader>[0])
  }

  it('sends signed-out visitors to sign-in, returning to the requested page', async () => {
    server.use(
      http.get(currentPath, () => new HttpResponse(null, { status: 401 })),
    )

    const response: unknown = await load(
      '/applications/0199a8bb/personal-details',
    ).catch((thrown: unknown) => thrown)

    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe(
      '/sign-in?returnTo=%2Fapplications%2F0199a8bb%2Fpersonal-details',
    )
  })

  it('drops a return target that is not a journey page', async () => {
    server.use(
      http.get(currentPath, () => new HttpResponse(null, { status: 401 })),
    )

    const response: unknown = await load('/applications').catch(
      (thrown: unknown) => thrown,
    )

    expect((response as Response).headers.get('Location')).toBe('/sign-in')
  })

  it('lets signed-in Applicants in and caches the current application for the page', async () => {
    let requests = 0
    server.use(
      http.get(currentPath, () => {
        requests += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(load('/applications/current')).resolves.toBeNull()
    expect(
      sharedQueryClient.getQueryData(['applications', 'current']),
    ).toBeNull()
    expect(requests).toBe(1)
  })

  it('does not block the area when the check fails for another reason', async () => {
    server.use(
      http.get(currentPath, () => new HttpResponse(null, { status: 503 })),
    )

    await expect(load('/applications/current')).resolves.toBeNull()
  })
})
