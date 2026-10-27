import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { createRoutesStub, useParams } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queryClient as sharedQueryClient } from '../../query-client'
import {
  apiPaths,
  applicationId,
  completeAnswers,
  errorResponse,
  formDocument,
  jsonApiResponse,
} from '../../test/api-fixtures'
import { server } from '../../test/server'

import ApplicationStepPage, { clientLoader } from './$applicationId/$step'

import type { ApplicationAnswers } from '../../api/applications'
import type { ComponentProps } from 'react'

expect.extend(toHaveNoViolations)

const formPath = apiPaths.form()

function StepRoute() {
  const params = useParams()
  return (
    <ApplicationStepPage
      {...({ params } as unknown as ComponentProps<typeof ApplicationStepPage>)}
    />
  )
}

function renderStep(step = 'personal-details') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Stub = createRoutesStub([
    { path: '/applications/:applicationId/:step', Component: StepRoute },
    { path: '/applications/current', Component: () => <p>Journey page</p> },
  ])
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <Stub initialEntries={[`/applications/${applicationId}/${step}`]} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), container }
}

const field = (name: string) => screen.getByRole('textbox', { name })
const status = () => screen.getByRole('status')

describe('Application step page', () => {
  it('fills every saved answer of the personal details step', async () => {
    server.use(http.get(formPath, () => jsonApiResponse(formDocument())))
    renderStep()

    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue(
      'Ada Lovelace',
    )
    expect(field('Date of birth')).toHaveValue('1815-12-10')
    expect(field('Country')).toHaveValue('United Kingdom')
    expect(field('Nationality')).toHaveValue('British')
    expect(field('Email')).toHaveValue('ada@example.test')
    expect(field('Phone')).toHaveValue('+44 20 7946 0000')
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('fills every saved answer of the identity and address step', async () => {
    server.use(
      http.get(formPath, () =>
        jsonApiResponse(formDocument({ documentPresent: true })),
      ),
    )
    renderStep('identity-and-address')

    expect(
      await screen.findByRole('textbox', { name: 'Document type' }),
    ).toHaveValue('Passport')
    expect(field('Document number')).toHaveValue('AL1815')
    expect(field('Document country')).toHaveValue('United Kingdom')
    expect(field('Expiry')).toHaveValue('2030-01-01')
    expect(field('Street')).toHaveValue('12 St James Square')
    expect(field('City')).toHaveValue('London')
    expect(field('Postal code')).toHaveValue('SW1Y 4JH')
    expect(field('Residential country')).toHaveValue('United Kingdom')
    expect(
      screen.getByText(
        'An identity document image is saved with this application.',
      ),
    ).toBeInTheDocument()
  })

  it('leaves unanswered fields empty', async () => {
    server.use(
      http.get(formPath, () =>
        jsonApiResponse(
          formDocument({
            // The contract describes unanswered fields as "omitted or null",
            // but its schema types them as strings only.
            answers: {
              name: 'Ada',
              phone: null,
            } as unknown as ApplicationAnswers,
          }),
        ),
      ),
    )
    renderStep()

    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue(
      'Ada',
    )
    expect(field('Phone')).toHaveValue('')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('flags unsaved changes from the first edit and clears the flag when undone', async () => {
    server.use(http.get(formPath, () => jsonApiResponse(formDocument())))
    const { user } = renderStep()
    const name = await screen.findByRole('textbox', { name: 'Name' })

    expect(status()).toBeEmptyDOMElement()
    await user.type(name, 'x')
    expect(status()).toHaveTextContent('You have unsaved changes.')

    await user.type(name, '{Backspace}')
    expect(status()).toBeEmptyDOMElement()
  })

  it('keeps edits made while a save is in flight marked as unsaved', async () => {
    let release: () => void = () => {}
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return jsonApiResponse(formDocument({ version: 5 }))
      }),
    )
    const { user } = renderStep()
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await user.type(name, '!')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.type(name, '?')
    release()

    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute(
        'aria-disabled',
      ),
    )
    expect(status()).toHaveTextContent('You have unsaved changes.')
  })

  it('saves the step answers with the loaded version and confirms only after the API succeeds', async () => {
    let body: unknown
    let release: () => void = () => {}
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, async ({ request }) => {
        body = await request.json()
        await new Promise<void>((resolve) => (release = resolve))
        return jsonApiResponse(
          formDocument({
            answers: { ...completeAnswers, name: 'Ada King' },
            version: 5,
          }),
        )
      }),
    )
    const { user } = renderStep()
    const name = await screen.findByRole('textbox', { name: 'Name' })

    await user.clear(name)
    await user.type(name, 'Ada King')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(status()).toHaveTextContent('You have unsaved changes.')
    release()
    expect(await screen.findByText('Your answers have been saved.')).toBe(
      status(),
    )
    expect(body).toEqual({
      data: {
        type: 'applicant-application-forms',
        id: applicationId,
        attributes: {
          step: 'personal-details',
          version: 4,
          answers: {
            name: 'Ada King',
            dateOfBirth: '1815-12-10',
            country: 'United Kingdom',
            nationality: 'British',
            email: 'ada@example.test',
            phone: '+44 20 7946 0000',
            consentConfirmed: true,
          },
        },
      },
    })
  })

  it('sends the version returned by the previous save and flags new edits', async () => {
    const versions: unknown[] = []
    let version = 4
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, async ({ request }) => {
        const body = (await request.json()) as {
          data: { attributes: { version: number } }
        }
        versions.push(body.data.attributes.version)
        version += 1
        return jsonApiResponse(formDocument({ version }))
      }),
    )
    const { user } = renderStep()
    const save = await screen.findByRole('button', { name: 'Save' })

    await user.click(save)
    await screen.findByText('Your answers have been saved.')
    await user.type(field('Phone'), '1')

    expect(status()).toHaveTextContent('You have unsaved changes.')
    await user.click(save)
    await screen.findByText('Your answers have been saved.')
    expect(versions).toEqual([4, 5])
  })

  it('keeps entered values after a failed save and lets the Applicant retry', async () => {
    let attempts = 0
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, () => {
        attempts += 1
        return attempts === 1
          ? new HttpResponse(null, { status: 503 })
          : jsonApiResponse(formDocument({ version: 5 }))
      }),
    )
    const { user } = renderStep()
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Ada King')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your answers were not saved')
    expect(alert).toHaveTextContent('Something went wrong on our side.')
    expect(alert.parentElement).toHaveFocus()
    expect(name).toHaveValue('Ada King')
    expect(status()).toHaveTextContent('You have unsaved changes.')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Your answers have been saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains a version conflict and reloads the saved answers on request', async () => {
    let loads = 0
    server.use(
      http.get(formPath, () => {
        loads += 1
        return loads === 1
          ? jsonApiResponse(formDocument())
          : jsonApiResponse(
              formDocument({
                answers: { ...completeAnswers, name: 'Changed elsewhere' },
                version: 9,
              }),
            )
      }),
      http.patch(formPath, () => errorResponse(409, 'form-version-conflict')),
    )
    const { user } = renderStep()
    const name = await screen.findByRole('textbox', { name: 'Name' })
    await user.type(name, ' (draft)')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This application was changed in another window or on another device.',
    )
    expect(name).toHaveValue('Ada Lovelace (draft)')

    await user.click(
      screen.getByRole('button', { name: 'Reload saved answers' }),
    )

    expect(
      await screen.findByDisplayValue('Changed elsewhere'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Personal details' }),
    ).toHaveFocus()
  })

  it.each([
    [401, 'authentication-required'],
    [403, 'access-denied'],
  ])(
    'asks the Applicant to sign in again when saving returns %i',
    async (statusCode, code) => {
      server.use(
        http.get(formPath, () => jsonApiResponse(formDocument())),
        http.patch(formPath, () => errorResponse(statusCode, code)),
      )
      const { user } = renderStep()

      await user.click(await screen.findByRole('button', { name: 'Save' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(
        'Your session has expired. Your latest changes on this page were not saved.',
      )
      expect(
        within(alert).getByRole('link', { name: 'Sign in again' }),
      ).toHaveAttribute(
        'href',
        `/sign-in?returnTo=${encodeURIComponent(`/applications/${applicationId}/personal-details`)}`,
      )
    },
  )

  it('shows a clear message when the API rejects the answers', async () => {
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, () => errorResponse(422, 'unprocessable-form')),
    )
    const { user } = renderStep()

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some answers could not be accepted. Check your answers and try again.',
    )
  })

  it('saves and continues to the next step', async () => {
    server.use(
      http.get(formPath, () => jsonApiResponse(formDocument())),
      http.patch(formPath, () => jsonApiResponse(formDocument({ version: 5 }))),
    )
    const { user } = renderStep()

    await user.click(
      await screen.findByRole('button', { name: 'Save and continue' }),
    )

    const heading = await screen.findByRole('heading', {
      name: 'Identity and address',
    })
    // Focus moves to the new step instead of falling to the document body.
    expect(heading).toHaveFocus()
    expect(field('Document type')).toHaveValue('Passport')
  })

  it.each([
    [401, 'authentication-required', 'Your session has expired.'],
    [404, 'application-not-found', 'We could not find this application.'],
  ])(
    'explains why the form could not be loaded (%i)',
    async (statusCode, code, message) => {
      server.use(http.get(formPath, () => errorResponse(statusCode, code)))
      renderStep()

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    },
  )

  it('has no automated accessibility violations', async () => {
    server.use(http.get(formPath, () => jsonApiResponse(formDocument())))
    const { container } = renderStep()
    await screen.findByRole('textbox', { name: 'Name' })

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Application step loader', () => {
  afterEach(() => sharedQueryClient.clear())

  function load(step: string) {
    return clientLoader({
      params: { applicationId, step },
    } as unknown as Parameters<typeof clientLoader>[0])
  }

  it('loads the saved answers before the page renders', async () => {
    server.use(http.get(formPath, () => jsonApiResponse(formDocument())))

    await load('personal-details')

    expect(
      sharedQueryClient.getQueryData(['applications', applicationId, 'form']),
    ).toEqual(formDocument().data)
  })

  it('leaves load failures to the page instead of throwing', async () => {
    server.use(
      http.get(formPath, () => errorResponse(401, 'authentication-required')),
    )

    await expect(load('personal-details')).resolves.toBeNull()
  })

  it('rejects unknown steps with 404', async () => {
    const thrown: unknown = await load('unknown-step').catch(
      (error: unknown) => error,
    )

    expect(thrown).toMatchObject({ init: { status: 404 } })
  })
})
