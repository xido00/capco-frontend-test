import { expect, test } from '@playwright/test'

import { registerApplicant, signIn } from './support'

test.describe('Applicant area for signed-out visitors', () => {
  for (const [path, signInUrl] of [
    ['/applications', '/sign-in'],
    ['/applications/current', '/sign-in?returnTo=%2Fapplications%2Fcurrent'],
    [
      '/applications/00000000-0000-4000-8000-000000000010/personal-details',
      '/sign-in?returnTo=%2Fapplications%2F00000000-0000-4000-8000-000000000010%2Fpersonal-details',
    ],
  ] as const) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(signInUrl)
      await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Sign out' }),
      ).not.toBeVisible()
    })
  }

  test('signing in afterwards opens the Applicant journey', async ({
    page,
  }) => {
    const email = await registerApplicant(page, 'access')
    await page.goto('/applications/current')
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/)

    await signIn(page, email)

    await expect(
      page.getByRole('button', { name: 'Start application' }),
    ).toBeVisible()
  })
})
