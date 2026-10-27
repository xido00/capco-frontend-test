import { describe, expect, it } from 'vitest'

import { validateRegistration } from './-applicant-credentials'

const valid = {
  email: 'ada@example.test',
  password: 'Secret!',
  confirmPassword: 'Secret!',
}

describe('validateRegistration', () => {
  it('accepts values that meet the API rules', () => {
    expect(validateRegistration(valid)).toEqual({})
  })

  it('accepts an email surrounded by spaces, as the API trims it', () => {
    expect(
      validateRegistration({ ...valid, email: '  ada@example.test ' }),
    ).toEqual({})
  })

  it('reports every empty field at once', () => {
    expect(
      validateRegistration({ email: '', password: '', confirmPassword: '' }),
    ).toEqual({
      email: 'Enter your email address',
      password: 'Enter a password',
      confirmPassword: 'Confirm your password',
    })
  })

  it.each(['ada', 'ada@example', 'ada @example.test', '@example.test'])(
    'rejects the malformed email %s',
    (email) => {
      expect(validateRegistration({ ...valid, email }).email).toBe(
        'Enter an email address in the correct format, like name@example.com',
      )
    },
  )

  it.each([
    ['too short', 'Ab!'],
    ['no uppercase letter', 'secret!'],
    ['no special character', 'Secret1'],
  ])('rejects a password with %s', (_, password) => {
    expect(
      validateRegistration({ ...valid, password, confirmPassword: password })
        .password,
    ).toBe(
      'Password must be at least 6 characters and include an uppercase letter and a special character',
    )
  })

  it('counts a space as a special character, like the API', () => {
    expect(
      validateRegistration({
        ...valid,
        password: 'Secret word',
        confirmPassword: 'Secret word',
      }),
    ).toEqual({})
  })

  it('reports mismatched passwords even when other fields are invalid', () => {
    expect(
      validateRegistration({
        email: 'ada',
        password: 'Secret!',
        confirmPassword: 'Secret?',
      }).confirmPassword,
    ).toBe('Passwords do not match')
  })
})
