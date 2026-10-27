import { expect, type Page } from '@playwright/test'

export const applicantPassword = 'Secret!1'

/** Registers a fresh Applicant through the API and returns its email. */
export async function registerApplicant(
  page: Page,
  prefix = 'applicant',
): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const response = await page.request.post('/api/v1/applicant-accounts', {
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    data: JSON.stringify({
      data: {
        type: 'applicant-accounts',
        attributes: { email, password: applicantPassword },
      },
    }),
  })
  expect(response.status()).toBe(201)
  return email
}

export async function signIn(
  page: Page,
  email: string,
  password = applicantPassword,
) {
  await page.goto('/sign-in')
  await expect(page).toHaveTitle('Sign in – KYC')
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

/** Signs in a new Applicant and opens the first step of a new draft. */
export async function startApplication(page: Page) {
  await signIn(page, await registerApplicant(page))
  await page.getByRole('button', { name: 'Start application' }).click()
  await expect(
    page.getByRole('heading', { name: 'Personal details' }),
  ).toBeVisible()
}
