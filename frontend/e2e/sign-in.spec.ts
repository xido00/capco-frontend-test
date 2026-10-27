import { expect, test, type Page } from '@playwright/test'

const password = 'Secret!1'

async function registerApplicant(page: Page): Promise<string> {
  const email = `sign-in-${Date.now()}@example.test`
  const response = await page.request.post('/api/v1/applicant-accounts', {
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    data: JSON.stringify({
      data: { type: 'applicant-accounts', attributes: { email, password } },
    }),
  })
  expect(response.status()).toBe(201)
  return email
}

async function signIn(page: Page, email: string, withPassword: string) {
  await page.goto('/sign-in')
  await expect(page).toHaveTitle('Sign in – KYC')
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.getByLabel('Password').fill(withPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('applicant signs in and continues at the journey URL from the API', async ({
  page,
  context,
}) => {
  const email = await registerApplicant(page)

  await signIn(page, email, password)

  await expect(page).toHaveURL('/applications/current')
  const cookieNames = (await context.cookies()).map(({ name }) => name)
  expect(cookieNames).toEqual(
    expect.arrayContaining(['__Host-KYCSESSION', 'XSRF-TOKEN']),
  )
})

test('invalid credentials show one message and keep the email', async ({
  page,
}) => {
  const email = await registerApplicant(page)

  await signIn(page, email, 'Wrong!1')

  await expect(page.getByRole('alert')).toContainText(
    'The email address or password is incorrect.',
  )
  await expect(
    page.getByRole('textbox', { name: 'Email address' }),
  ).toHaveValue(email)
  await expect(page.getByLabel('Password')).toHaveValue('')
  await expect(page).toHaveURL('/sign-in')
})

test('a password that breaks the policy gets the same generic message', async ({
  page,
}) => {
  const email = await registerApplicant(page)

  await signIn(page, email, 'short')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText(
    'The email address or password is incorrect.',
  )
  await expect(alert).not.toContainText('uppercase')
  await expect(page.getByLabel('Password')).toHaveValue('')
})
