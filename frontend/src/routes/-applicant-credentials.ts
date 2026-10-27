import { z } from 'zod'

// Mirrors the backend rules (EmailAddress, Password) so the API rarely has to reject input.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const uppercaseLetter = /\p{Lu}/u
const specialCharacter = /[^\p{L}\p{Nd}]/u

export const passwordGuidance =
  'Use at least 6 characters, including an uppercase letter and a special character, like ! or #.'

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .regex(
    emailPattern,
    'Enter an email address in the correct format, like name@example.com',
  )

const newPassword = z
  .string()
  .min(1, 'Enter a password')
  .refine(
    (value) =>
      value.length >= 6 &&
      uppercaseLetter.test(value) &&
      specialCharacter.test(value),
    'Password must be at least 6 characters and include an uppercase letter and a special character',
  )

const confirmPassword = z.string().min(1, 'Confirm your password')

export type RegistrationField = 'email' | 'password' | 'confirmPassword'
export type RegistrationValues = Record<RegistrationField, string>
export type RegistrationErrors = Partial<Record<RegistrationField, string>>

/**
 * Returns the first message per invalid field; an empty object means valid.
 * Fields are checked independently so every problem is reported at once.
 */
export function validateRegistration(
  values: RegistrationValues,
): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const checks = [
    ['email', email],
    ['password', newPassword],
    ['confirmPassword', confirmPassword],
  ] as const
  for (const [field, schema] of checks) {
    const result = schema.safeParse(values[field])
    if (!result.success) {
      errors[field] = result.error.issues[0]?.message
    }
  }
  if (!errors.confirmPassword && values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match'
  }
  return errors
}
