import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createRoutesStub, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { jsonApiMediaType } from '../../api/client'
import { server } from '../../test/server'
import ApplicationsLayout from '../applications'

import ApplicationStepPage from './$applicationId/$step'

import type { ComponentProps } from 'react'

const applicationId = '0199a8bb-8687-7c22-aed5-55d432f50f23'
const formPath = `/api/v1/applicant-applications/${applicationId}/form`

function formDocument(version = 1) {
  return {
    data: {
      type: 'applicant-application-forms',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [],
        answers: { name: 'Ada' },
        documentEvidence: { present: false },
        version,
      },
    },
  }
}

function StepRoute() {
  const params = useParams()
  return (
    <ApplicationStepPage
      {...({ params } as unknown as ComponentProps<typeof ApplicationStepPage>)}
    />
  )
}

function renderJourney() {
  server.use(
    http.get(formPath, () =>
      HttpResponse.json(formDocument(), {
        headers: { 'Content-Type': jsonApiMediaType },
      }),
    ),
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Stub = createRoutesStub([
    {
      path: '/applications',
      Component: ApplicationsLayout,
      children: [
        { path: 'current', Component: () => <p>Journey page</p> },
        { path: ':applicationId/:step', Component: StepRoute },
      ],
    },
    { path: '/sign-in', Component: () => <p>Sign-in page</p> },
  ])
  render(
    <QueryClientProvider client={queryClient}>
      <Stub
        initialEntries={[`/applications/${applicationId}/personal-details`]}
      />
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

async function editName(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Name' }), ' King')
}

describe('Unsaved changes', () => {
  it('leaves without asking when nothing was edited', async () => {
    const user = renderJourney()

    await user.click(await screen.findByRole('button', { name: 'Back' }))

    expect(await screen.findByText('Journey page')).toBeInTheDocument()
  })

  it('asks before leaving with unsaved edits and keeps them when staying', async () => {
    const user = renderJourney()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(
      screen.getByRole('alertdialog', { name: 'Leave without saving?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stay on this page' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Ada King',
    )
  })

  it('leaves and discards the edits when the Applicant confirms', async () => {
    const user = renderJourney()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(
      screen.getByRole('button', { name: 'Leave without saving' }),
    )

    expect(await screen.findByText('Journey page')).toBeInTheDocument()
  })

  it('does not ask after "Save and continue" saved the edits', async () => {
    server.use(
      http.patch(formPath, () =>
        HttpResponse.json(formDocument(2), {
          headers: { 'Content-Type': jsonApiMediaType },
        }),
      ),
    )
    const user = renderJourney()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Save and continue' }))

    expect(
      await screen.findByRole('heading', { name: 'Identity and address' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks before signing out with unsaved edits, then signs out', async () => {
    let signOutRequests = 0
    server.use(
      http.delete('/api/v1/applicant-sessions/current', () => {
        signOutRequests += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = renderJourney()
    await editName(user)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(
      screen.getByRole('alertdialog', { name: 'Sign out without saving?' }),
    ).toBeInTheDocument()
    expect(signOutRequests).toBe(0)

    await user.click(
      screen.getByRole('button', { name: 'Sign out without saving' }),
    )

    expect(await screen.findByText('Sign-in page')).toBeInTheDocument()
    expect(signOutRequests).toBe(1)
  })
})
