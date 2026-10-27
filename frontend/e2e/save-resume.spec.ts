import { expect, test } from '@playwright/test'

import { registerApplicant, signIn } from './support'

const personalDetails = {
  Name: 'Ada Lovelace',
  'Date of birth': '1815-12-10',
  Country: 'United Kingdom',
  Nationality: 'British',
  Email: 'ada@example.test',
  Phone: '+44 20 7946 0000',
}

test('saved answers come back after signing out and in again', async ({
  page,
}) => {
  const email = await registerApplicant(page, 'save-resume')
  await signIn(page, email)

  await page.getByRole('button', { name: 'Start application' }).click()
  await expect(
    page.getByRole('heading', { name: 'Personal details' }),
  ).toBeVisible()
  for (const [label, value] of Object.entries(personalDetails)) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(value)
  }
  // React Aria visually hides the native input; applicants click the label.
  await page
    .getByText('I confirm these details are accurate and belong to me.')
    .click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(
    page.getByRole('heading', { name: 'Identity and address' }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Street' }).fill('12 St James Square')
  await page.getByRole('textbox', { name: 'City' }).fill('London')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Your answers have been saved.',
  )

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/sign-in')

  // The API sends the Applicant back to their current step.
  await signIn(page, email)
  await expect(
    page.getByRole('heading', { name: 'Identity and address' }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Street' })).toHaveValue(
    '12 St James Square',
  )
  await expect(page.getByRole('textbox', { name: 'City' })).toHaveValue(
    'London',
  )

  await page.getByRole('button', { name: 'Back' }).click()
  for (const [label, value] of Object.entries(personalDetails)) {
    await expect(
      page.getByRole('textbox', { name: label, exact: true }),
    ).toHaveValue(value)
  }
  await expect(page.getByRole('checkbox')).toBeChecked()
})
