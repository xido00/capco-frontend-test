import { expect, test } from '@playwright/test'

import { registerApplicant, signIn } from './support'

test('applicant signs in and continues at the journey URL from the API', async ({
  page,
  context,
}) => {
  const email = await registerApplicant(page, 'sign-in')

  await signIn(page, email)

  await expect(page).toHaveTitle('Your KYC application – KYC')
  await expect(page).toHaveURL('/applications/current')
  const cookieNames = (await context.cookies()).map(({ name }) => name)
  expect(cookieNames).toEqual(
    expect.arrayContaining(['__Host-KYCSESSION', 'XSRF-TOKEN']),
  )
})

test('invalid credentials show one message and keep the email', async ({
  page,
}) => {
  const email = await registerApplicant(page, 'sign-in')

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
  const email = await registerApplicant(page, 'sign-in')

  await signIn(page, email, 'short')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText(
    'The email address or password is incorrect.',
  )
  await expect(alert).not.toContainText('uppercase')
  await expect(page.getByLabel('Password')).toHaveValue('')
})
