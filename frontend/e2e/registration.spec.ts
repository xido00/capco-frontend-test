import { expect, test } from '@playwright/test'

test('applicant creates an account and cannot register the same email twice', async ({
  page,
}) => {
  const email = `applicant-${Date.now()}@example.test`

  async function register() {
    await page.goto('/create-account?returnTo=%2Fapplications%2Fcurrent')
    await expect(page).toHaveTitle('Create your account – KYC')
    await page.getByRole('textbox', { name: 'Email address' }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill('Secret!1')
    await page.getByLabel('Confirm password').fill('Secret!1')
    await page.getByRole('button', { name: 'Create account' }).click()
  }

  await register()
  await expect(
    page.getByRole('heading', { name: 'Account created' }),
  ).toBeFocused()
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/sign-in?returnTo=%2Fapplications%2Fcurrent',
  )

  await register()
  await expect(page.getByRole('alert')).toContainText(
    'An account already exists for this email address.',
  )
  await expect(
    page.getByRole('textbox', { name: 'Email address' }),
  ).toHaveAttribute('aria-invalid', 'true')
})
