import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { createRoutesStub, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { jsonApiMediaType } from '../../api/client'
import { server } from '../../test/server'

import ApplicationStepPage from './$applicationId/$step'

import type { ComponentProps } from 'react'

expect.extend(toHaveNoViolations)

const applicationId = '0199a8bb-8687-7c22-aed5-55d432f50f23'
const formPath = `/api/v1/applicant-applications/${applicationId}/form`

const savedAnswers = {
  name: 'Ada Lovelace',
  dateOfBirth: '1815-12-10',
  country: 'United Kingdom',
  nationality: 'British',
  email: 'ada@example.test',
  phone: '+44 20 7946 0000',
  consentConfirmed: true,
  documentType: 'Passport',
  documentNumber: 'AL1815',
  documentCountry: 'United Kingdom',
  expiry: '2030-01-01',
  street: '12 St James Square',
  city: 'London',
  postal: 'SW1Y 4JH',
  residentialCountry: 'United Kingdom',
}

function formDocument(
  answers: Record<string, unknown> = savedAnswers,
  version = 4,
  documentPresent = false,
) {
  return {
    data: {
      type: 'applicant-application-forms',
      id: applicationId,
      attributes: {
        status: 'draft',
        currentStep: 'personal-details',
        steps: [],
        answers,
        documentEvidence: { present: documentPresent },
        version,
      },
    },
  }
}

function json(body: JsonBodyType, status = 200) {
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': jsonApiMediaType },
  })
}

function errorDocument(status: number, code: string) {
  return json(
    {
      errors: [{ status: String(status), code, title: 'Error', detail: 'x' }],
    },
    status,
  )
}

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
    server.use(http.get(formPath, () => json(formDocument())))
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
      http.get(formPath, () => json(formDocument(savedAnswers, 4, true))),
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
        json(formDocument({ name: 'Ada', phone: null })),
      ),
    )
    renderStep()

    expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue(
      'Ada',
    )
    expect(field('Phone')).toHaveValue('')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('saves the step answers with the loaded version and confirms only after the API succeeds', async () => {
    let body: unknown
    let release: () => void = () => {}
    server.use(
      http.get(formPath, () => json(formDocument())),
      http.patch(formPath, async ({ request }) => {
        body = await request.json()
        await new Promise<void>((resolve) => (release = resolve))
        return json(formDocument({ ...savedAnswers, name: 'Ada King' }, 5))
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
    expect(status()).not.toHaveTextContent('saved')
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
      http.get(formPath, () => json(formDocument())),
      http.patch(formPath, async ({ request }) => {
        const body = (await request.json()) as {
          data: { attributes: { version: number } }
        }
        versions.push(body.data.attributes.version)
        version += 1
        return json(formDocument(savedAnswers, version))
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
      http.get(formPath, () => json(formDocument())),
      http.patch(formPath, () => {
        attempts += 1
        return attempts === 1
          ? new HttpResponse(null, { status: 503 })
          : json(formDocument(savedAnswers, 5))
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
    expect(status()).toHaveTextContent('')

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
          ? json(formDocument())
          : json(
              formDocument({ ...savedAnswers, name: 'Changed elsewhere' }, 9),
            )
      }),
      http.patch(formPath, () => errorDocument(409, 'form-version-conflict')),
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
  })

  it.each([
    [401, 'authentication-required'],
    [403, 'access-denied'],
  ])(
    'asks the Applicant to sign in again when saving returns %i',
    async (statusCode, code) => {
      server.use(
        http.get(formPath, () => json(formDocument())),
        http.patch(formPath, () => errorDocument(statusCode, code)),
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
      http.get(formPath, () => json(formDocument())),
      http.patch(formPath, () => errorDocument(422, 'unprocessable-form')),
    )
    const { user } = renderStep()

    await user.click(await screen.findByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some answers could not be accepted. Check your answers and try again.',
    )
  })

  it('saves and continues to the next step', async () => {
    server.use(
      http.get(formPath, () => json(formDocument())),
      http.patch(formPath, () => json(formDocument(savedAnswers, 5))),
    )
    const { user } = renderStep()

    await user.click(
      await screen.findByRole('button', { name: 'Save and continue' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Identity and address' }),
    ).toBeInTheDocument()
    expect(field('Document type')).toHaveValue('Passport')
  })

  it.each([
    [401, 'authentication-required', 'Your session has expired.'],
    [404, 'application-not-found', 'We could not find this application.'],
  ])(
    'explains why the form could not be loaded (%i)',
    async (statusCode, code, message) => {
      server.use(http.get(formPath, () => errorDocument(statusCode, code)))
      renderStep()

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    },
  )

  it('has no automated accessibility violations', async () => {
    server.use(http.get(formPath, () => json(formDocument())))
    const { container } = renderStep()
    await screen.findByRole('textbox', { name: 'Name' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
