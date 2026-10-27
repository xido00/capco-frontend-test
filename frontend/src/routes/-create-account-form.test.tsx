import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { apiPaths, errorResponse } from '../test/api-fixtures'
import { server } from '../test/server'

import { CreateAccountForm } from './-create-account-form'

expect.extend(toHaveNoViolations)

const accountsPath = apiPaths.accounts

function renderForm(returnTo?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <CreateAccountForm returnTo={returnTo} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), container }
}

const emailInput = () => screen.getByRole('textbox', { name: 'Email address' })
const passwordInput = () => screen.getByLabelText('Password')
const confirmInput = () => screen.getByLabelText('Confirm password')
const submitButton = () =>
  screen.getByRole('button', { name: /create account/i })

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(emailInput(), 'ada@example.test')
  await user.type(passwordInput(), 'Secret!')
  await user.type(confirmInput(), 'Secret!')
}

function respondWith(response: () => Response) {
  server.use(http.post(accountsPath, response))
}

describe('CreateAccountForm', () => {
  it('lists every invalid field in a focused summary without calling the API', async () => {
    const { user } = renderForm()

    await user.click(submitButton())

    const summary = screen.getByRole('alert')
    expect(summary.parentElement).toHaveFocus()
    for (const message of [
      'Enter your email address',
      'Enter a password',
      'Confirm your password',
    ]) {
      expect(screen.getByRole('link', { name: message })).toBeInTheDocument()
    }
    expect(emailInput()).toHaveAccessibleDescription('Enter your email address')
  })

  it('keeps the password rules visible next to a password error', async () => {
    const { user } = renderForm()

    await user.type(passwordInput(), 'short')
    await user.click(submitButton())

    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput()).toHaveAccessibleDescription(
      /Use at least 6 characters.*Password must be at least 6 characters/,
    )
  })

  it('updates inline errors while typing after a failed submit', async () => {
    const { user } = renderForm()
    await user.click(submitButton())

    await user.type(emailInput(), 'ada@example.test')

    expect(emailInput()).not.toHaveAttribute('aria-invalid')
    // The summary is a live region; it only changes on the next submit.
    expect(
      screen.getByRole('link', { name: 'Enter your email address' }),
    ).toBeInTheDocument()
  })

  it('reports mismatched passwords', async () => {
    const { user } = renderForm()

    await user.type(emailInput(), 'ada@example.test')
    await user.type(passwordInput(), 'Secret!')
    await user.type(confirmInput(), 'Secret?')
    await user.click(submitButton())

    expect(
      screen.getByRole('link', { name: 'Passwords do not match' }),
    ).toBeInTheDocument()
  })

  it('creates the account and links to sign-in, keeping the return target', async () => {
    let body: unknown
    respondWith(() => new HttpResponse(null, { status: 201 }))
    server.events.on('request:start', ({ request }) => {
      void request
        .clone()
        .json()
        .then((json: unknown) => (body = json))
    })
    const { user } = renderForm('/applications/current')

    await fillValidForm(user)
    await user.click(submitButton())

    const heading = await screen.findByRole('heading', {
      name: 'Account created',
    })
    expect(heading).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?returnTo=%2Fapplications%2Fcurrent',
    )
    expect(body).toEqual({
      data: {
        type: 'applicant-accounts',
        attributes: { email: 'ada@example.test', password: 'Secret!' },
      },
    })
    server.events.removeAllListeners()
  })

  it('shows API field errors next to their fields', async () => {
    respondWith(() =>
      errorResponse(400, [
        {
          code: 'validation-failed',
          detail: 'Enter a valid email address.',
          pointer: '/data/attributes/email',
        },
      ]),
    )
    const { user } = renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByRole('link', { name: 'Enter a valid email address.' }),
    ).toBeInTheDocument()
    expect(emailInput()).toHaveAccessibleDescription(
      'Enter a valid email address.',
    )
  })

  it('explains that the email is already registered', async () => {
    respondWith(() =>
      errorResponse(409, [
        {
          code: 'email-already-registered',
          detail: 'An account already exists for this email address.',
        },
      ]),
    )
    const { user } = renderForm()

    await fillValidForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByRole('link', {
        name: /An account already exists for this email address/,
      }),
    ).toBeInTheDocument()
    expect(emailInput()).toHaveValue('ada@example.test')
  })

  it.each([
    [
      'rate limiting',
      () =>
        errorResponse(
          429,
          [{ code: 'rate-limited', detail: 'Too many attempts.' }],
          { 'Retry-After': '30' },
        ),
      'Too many attempts. Try again in 30 seconds.',
    ],
    [
      'network failure',
      () => HttpResponse.error(),
      'We could not reach the server. Check your connection and try again.',
    ],
    [
      'an unexpected response',
      () => new HttpResponse(null, { status: 500 }),
      'Something went wrong on our side. Try again later.',
    ],
    [
      'a malformed document error',
      () =>
        errorResponse(400, [
          { code: 'malformed-document', detail: 'Not a JSON:API document.' },
        ]),
      'Something went wrong on our side. Try again later.',
    ],
  ])(
    'shows a form-level message for %s and keeps the entered values',
    async (_, response, message) => {
      respondWith(response)
      const { user } = renderForm()

      await fillValidForm(user)
      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(emailInput()).toHaveValue('ada@example.test')
      expect(passwordInput()).toHaveValue('Secret!')
    },
  )

  it('sends one request while a submission is pending', async () => {
    let requests = 0
    let release: () => void = () => {}
    respondWith(() => {
      requests += 1
      return new Promise<Response>((resolve) => {
        release = () => resolve(new HttpResponse(null, { status: 201 }))
      }) as unknown as Response
    })
    const { user } = renderForm()
    await fillValidForm(user)
    const button = submitButton()

    await user.click(button)
    await user.click(button)
    await user.keyboard('{Enter}')

    expect(button).toHaveAccessibleName('Creating account…')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(requests).toBe(1)
    release()
    expect(
      await screen.findByRole('heading', { name: 'Account created' }),
    ).toBeInTheDocument()
  })

  it('has no automated accessibility violations while showing errors', async () => {
    const { user, container } = renderForm()
    await user.click(submitButton())

    expect(await axe(container)).toHaveNoViolations()
  })
})
