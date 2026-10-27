import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createRoutesStub } from 'react-router'
import { describe, expect, it } from 'vitest'

import { server } from '../test/server'

import ApplicationsLayout from './applications'

const sessionPath = '/api/v1/applicant-sessions/current'

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
