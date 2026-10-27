import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { jsonApiMediaType } from '../api/client'
import { server } from '../test/server'

import { SignInForm } from './-sign-in-form'

expect.extend(toHaveNoViolations)

const sessionsPath = '/api/v1/applicant-sessions'

function renderForm() {
  const onSuccess = vi.fn<(href: string) => void>()
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <SignInForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), container, onSuccess }
}

const emailInput = () => screen.getByRole('textbox', { name: 'Email address' })
const passwordInput = () => screen.getByLabelText('Password')
const submitButton = () => screen.getByRole('button', { name: 'Sign in' })

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(emailInput(), 'ada@example.test')
  await user.type(passwordInput(), 'Secret!1')
}

function sessionDocument(href: string) {
  return HttpResponse.json(
    {
      data: {
        type: 'applicant-sessions',
        id: '0199a8bb-8687-7c22-aed5-55d432f50f23',
        attributes: { href },
      },
    },
    { status: 201, headers: { 'Content-Type': jsonApiMediaType } },
  )
}

function errorDocument(
  status: number,
  errors: { code: string; detail: string; pointer?: string }[],
  headers: Record<string, string> = {},
) {
  return HttpResponse.json(
    {
      errors: errors.map(({ code, detail, pointer }) => ({
        status: String(status),
        code,
        title: 'Error',
        detail,
        ...(pointer ? { source: { pointer } } : {}),
      })),
    },
    { status, headers: { 'Content-Type': jsonApiMediaType, ...headers } },
  )
}

describe('SignInForm', () => {
  it('requires both fields before calling the API', async () => {
    const { user } = renderForm()

    await user.click(submitButton())

    expect(screen.getByRole('alert').parentElement).toHaveFocus()
    expect(
      screen.getByRole('link', { name: 'Enter your email address' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Enter your password' }),
    ).toBeInTheDocument()
  })

  it('signs in with a JSON:API document and continues at the journey URL from the API', async () => {
    let body: unknown
    server.use(
      http.post(sessionsPath, async ({ request }) => {
        body = await request.json()
        return sessionDocument('/applications/0199a8bb/identity-and-address')
      }),
    )
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        '/applications/0199a8bb/identity-and-address',
      ),
    )
    expect(body).toEqual({
      data: {
        type: 'applicant-sessions',
        attributes: { email: 'ada@example.test', password: 'Secret!1' },
      },
    })
  })

  it('falls back to the default journey when the API returns a non-journey URL', async () => {
    server.use(http.post(sessionsPath, () => sessionDocument('/admin')))
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith('/applications/current'),
    )
  })

  it('shows one message for invalid credentials, keeps the email and clears the password', async () => {
    server.use(
      http.post(sessionsPath, () =>
        errorDocument(401, [
          { code: 'invalid-credentials', detail: 'Invalid email or password' },
        ]),
      ),
    )
    const { user, onSuccess } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The email address or password is incorrect. Check them and try again.',
    )
    expect(alert.parentElement).toHaveFocus()
    expect(emailInput()).toHaveValue('ada@example.test')
    expect(passwordInput()).toHaveValue('')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows malformed input errors next to their fields', async () => {
    server.use(
      http.post(sessionsPath, () =>
        errorDocument(400, [
          {
            code: 'validation-failed',
            detail: 'Enter a valid email address.',
            pointer: '/data/attributes/email',
          },
        ]),
      ),
    )
    const { user } = renderForm()

    await fillForm(user)
    await user.click(submitButton())

    expect(
      await screen.findByRole('link', { name: 'Enter a valid email address.' }),
    ).toBeInTheDocument()
    expect(emailInput()).toHaveAccessibleDescription(
      'Enter a valid email address.',
    )
  })

  it.each([
    [
      'rate limiting',
      () =>
        errorDocument(
          429,
          [{ code: 'rate-limited', detail: 'Too many attempts.' }],
          { 'Retry-After': '120' },
        ),
      'Too many attempts. Try again in 2 minutes.',
    ],
    [
      'network failure',
      () => HttpResponse.error(),
      'We could not reach the server. Check your connection and try again.',
    ],
    [
      'an unexpected response',
      () => new HttpResponse(null, { status: 503 }),
      'Something went wrong on our side. Try again later.',
    ],
  ])(
    'shows a message for %s and keeps the entered values',
    async (_, response, message) => {
      server.use(http.post(sessionsPath, response))
      const { user } = renderForm()

      await fillForm(user)
      await user.click(submitButton())

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(emailInput()).toHaveValue('ada@example.test')
      expect(passwordInput()).toHaveValue('Secret!1')
    },
  )

  it('sends one request while sign-in is pending and announces it', async () => {
    let requests = 0
    let release: () => void = () => {}
    server.use(
      http.post(sessionsPath, () => {
        requests += 1
        return new Promise<Response>((resolve) => {
          release = () => resolve(sessionDocument('/applications/current'))
        }) as unknown as Response
      }),
    )
    const { user, onSuccess } = renderForm()
    await fillForm(user)
    const button = submitButton()

    await user.click(button)
    await user.click(button)
    await user.keyboard('{Enter}')

    expect(button).toHaveAccessibleName('Signing in…')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(requests).toBe(1)
    release()
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('has no automated accessibility violations while showing errors', async () => {
    const { user, container } = renderForm()
    await user.click(submitButton())

    expect(await axe(container)).toHaveNoViolations()
  })
})
