import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { createRoutesStub } from 'react-router'
import { describe, expect, it } from 'vitest'

import { jsonApiMediaType } from '../../api/client'
import { server } from '../../test/server'

import CurrentApplicationJourneyPage from './current'

expect.extend(toHaveNoViolations)

const currentPath = '/api/v1/applicant-applications/current'
const applicationId = '0199a8bb-8687-7c22-aed5-55d432f50f23'

function applicationDocument(
  step: 'personal-details' | 'identity-and-address',
) {
  return {
    data: {
      type: 'applicant-applications',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: step,
        href: `/applications/${applicationId}/${step}`,
        progress:
          step === 'personal-details'
            ? [
                { step: 'personal-details', state: 'current' },
                { step: 'identity-and-address', state: 'not-started' },
              ]
            : [
                { step: 'personal-details', state: 'complete' },
                { step: 'identity-and-address', state: 'current' },
              ],
      },
    },
  }
}

function json(body: unknown, status = 200) {
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': jsonApiMediaType },
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Stub = createRoutesStub([
    { path: '/applications/current', Component: CurrentApplicationJourneyPage },
    {
      path: '/applications/:applicationId/:step',
      Component: () => <p>Step page</p>,
    },
  ])
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <Stub initialEntries={['/applications/current']} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), container }
}

describe('Current application page', () => {
  it('starts a draft when the Applicant has none and continues at its first step', async () => {
    server.use(
      http.get(currentPath, () => new HttpResponse(null, { status: 204 })),
      http.post('/api/v1/applicant-applications', () =>
        json(applicationDocument('personal-details'), 201),
      ),
    )
    const { user } = renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Start application' }),
    )

    expect(await screen.findByText('Step page')).toBeInTheDocument()
  })

  it('resumes the saved draft at the step and progress reported by the API', async () => {
    server.use(
      http.get(currentPath, () =>
        json(applicationDocument('identity-and-address')),
      ),
    )
    const { user } = renderPage()

    const resume = await screen.findByRole('button', {
      name: 'Resume application',
    })
    expect(
      screen.getByRole('list', { name: 'Application progress' }),
    ).toHaveTextContent(
      '1Personal detailsComplete2Identity and addressCurrent step',
    )

    await user.click(resume)

    expect(await screen.findByText('Step page')).toBeInTheDocument()
  })

  it('asks the Applicant to sign in again when the session has expired', async () => {
    server.use(
      http.get(currentPath, () =>
        json(
          {
            errors: [
              {
                status: '401',
                code: 'authentication-required',
                title: 'Authentication required',
                detail: 'Sign in to continue.',
              },
            ],
          },
          401,
        ),
      ),
    )
    renderPage()

    expect(
      await screen.findByRole('link', { name: 'Sign in again' }),
    ).toHaveAttribute('href', '/sign-in?returnTo=%2Fapplications%2Fcurrent')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session has expired.',
    )
  })

  it('offers a retry when the application cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get(currentPath, () => {
        calls += 1
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your application.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('button', { name: 'Start application' }),
    ).toBeInTheDocument()
  })

  it('explains when starting the application fails', async () => {
    server.use(
      http.get(currentPath, () => new HttpResponse(null, { status: 204 })),
      http.post('/api/v1/applicant-applications', () => HttpResponse.error()),
    )
    const { user } = renderPage()

    await user.click(
      await screen.findByRole('button', { name: 'Start application' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not start your application. We could not reach the server.',
    )
  })

  it('has no automated accessibility violations', async () => {
    server.use(
      http.get(currentPath, () =>
        json(applicationDocument('personal-details')),
      ),
    )
    const { container } = renderPage()
    await screen.findByRole('button', { name: 'Resume application' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
