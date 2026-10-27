import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { startApplication } from './support'

// Runs axe in a real browser, which also checks colour contrast and rendered
// states that jsdom-based unit tests cannot.
async function expectNoViolations(page: Page) {
  // In SPA mode <Meta /> sets the title after hydration. Scanning earlier
  // reports a missing <title>; waiting also checks every page has its own
  // title (WCAG 2.4.2).
  await expect(page).toHaveTitle(/ – KYC$/)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // React Aria's live announcer keeps announced messages for 7 s as
    // role="img" nodes labelled by the element that triggered them (for example
    // a pending button). After navigation that label is gone. The nodes are
    // transient, already announced and not our content.
    .exclude('[data-live-announcer="true"]')
    .analyze()
  expect(
    results.violations.map(({ id, help, nodes }) => ({
      id,
      help,
      targets: nodes.map(({ target }) => target.join(' ')),
    })),
  ).toEqual([])
}

test('sign-in page, including its error state', async ({ page }) => {
  await page.goto('/sign-in')
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoViolations(page)
})

test('registration page, including its error state', async ({ page }) => {
  await page.goto('/create-account')
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectNoViolations(page)
})

test('application journey pages and the unsaved changes dialog', async ({
  page,
}) => {
  await startApplication(page)
  await expectNoViolations(page)

  await page.getByRole('textbox', { name: 'Name' }).fill('Ada Lovelace')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(
    page.getByRole('heading', { name: 'Identity and address' }),
  ).toBeVisible()
  await expectNoViolations(page)

  await page.getByRole('textbox', { name: 'City' }).fill('London')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expectNoViolations(page)
})

test('not found page has a title, a way back and no violations', async ({
  page,
}) => {
  await startApplication(page)
  const stepUrl = page.url()

  await page.goto(stepUrl.replace('personal-details', 'unknown-step'))

  await expect(
    page.getByRole('heading', { level: 1, name: 'Page not found' }),
  ).toBeVisible()
  await expect(page).toHaveTitle('Page not found – KYC')
  await expect(
    page.getByRole('link', { name: 'Go to your application' }),
  ).toBeVisible()
  await expectNoViolations(page)
})
