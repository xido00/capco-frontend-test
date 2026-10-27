import {
  Button,
  Card,
  CardContent,
  ErrorSummary,
  Link,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { ApiError, fieldErrorsByAttribute } from '../api/api-error'
import { createApplicantAccount } from '../api/applicant-access'

import { formLevelMessage } from './-account-access-feedback'
import {
  passwordGuidance,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationField,
  type RegistrationValues,
} from './-applicant-credentials'
import { accountAccessHref } from './-return-target'
import styles from './account-access.module.css'

export interface CreateAccountFormProps {
  onNavigate?: (href: string) => void
  returnTo?: string
}

const fieldIds: Record<RegistrationField, string> = {
  email: 'applicant-email',
  password: 'applicant-password',
  confirmPassword: 'applicant-confirm-password',
}
const fieldOrder = Object.keys(fieldIds) as RegistrationField[]

interface Feedback {
  fieldErrors: RegistrationErrors
  message?: string
}

export function CreateAccountForm({
  onNavigate,
  returnTo,
}: CreateAccountFormProps) {
  const [values, setValues] = useState<RegistrationValues>({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({})
  // Snapshot from the last submit: the summary is a live region, so it must not change while typing.
  const [summary, setSummary] = useState<Feedback>()
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [createdEmail, setCreatedEmail] = useState<string>()
  const summaryRef = useRef<HTMLDivElement>(null)
  const successHeadingRef = useRef<HTMLHeadingElement>(null)
  const registration = useMutation({ mutationFn: createApplicantAccount })
  const signInHref = accountAccessHref('/sign-in', returnTo)

  function showFeedback(feedback: Feedback) {
    flushSync(() => {
      setFieldErrors(feedback.fieldErrors)
      setSummary(feedback)
    })
    summaryRef.current?.focus()
  }

  function update(field: RegistrationField, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (hasSubmitted) {
      // After the first submit, keep inline errors in step with what the applicant types.
      const errors = validateRegistration(next)
      setFieldErrors((current) => ({
        ...current,
        [field]: errors[field],
        ...(field === 'password'
          ? { confirmPassword: errors.confirmPassword }
          : {}),
      }))
    }
  }

  function submit() {
    if (registration.isPending) {
      return
    }
    setHasSubmitted(true)
    const errors = validateRegistration(values)
    if (Object.keys(errors).length > 0) {
      showFeedback({ fieldErrors: errors })
      return
    }
    const email = values.email.trim()
    registration.mutate(
      { email, password: values.password },
      {
        onSuccess: () => {
          flushSync(() => setCreatedEmail(email))
          successHeadingRef.current?.focus()
        },
        onError: (error) => showFeedback(feedbackFor(error)),
      },
    )
  }

  function navigateTo(href: string) {
    return (event: { preventDefault: () => void }) => {
      if (onNavigate) {
        event.preventDefault()
        onNavigate(href)
      }
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          {createdEmail ? (
            <Stack spacing={3}>
              <Typography
                component="h1"
                variant="heading"
                ref={successHeadingRef}
                tabIndex={-1}
              >
                Account created
              </Typography>
              <Typography>
                Your account for {createdEmail} is ready. Sign in to start your
                KYC application.
              </Typography>
              <Link
                className={styles.primaryLink}
                href={signInHref}
                onClick={navigateTo(signInHref)}
              >
                Sign in
              </Link>
            </Stack>
          ) : (
            <Stack
              component="form"
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
              spacing={3}
            >
              <Stack spacing={1}>
                <Typography component="h1" variant="heading">
                  Create your account
                </Typography>
                <Typography tone="muted">
                  Create credentials to begin your KYC application.
                </Typography>
              </Stack>
              <ErrorSummary
                ref={summaryRef}
                message={summary?.message}
                errors={fieldOrder.flatMap((field) => {
                  const message = summary?.fieldErrors[field]
                  return message ? [{ fieldId: fieldIds[field], message }] : []
                })}
              />
              <TextField
                autoComplete="email"
                errorMessage={fieldErrors.email}
                fullWidth
                id={fieldIds.email}
                label="Email address"
                name="email"
                onChange={(event) => update('email', event.target.value)}
                required
                type="email"
                value={values.email}
              />
              <TextField
                autoComplete="new-password"
                description={passwordGuidance}
                errorMessage={fieldErrors.password}
                fullWidth
                id={fieldIds.password}
                label="Password"
                name="password"
                onChange={(event) => update('password', event.target.value)}
                required
                type="password"
                value={values.password}
              />
              <TextField
                autoComplete="new-password"
                errorMessage={fieldErrors.confirmPassword}
                fullWidth
                id={fieldIds.confirmPassword}
                label="Confirm password"
                name="confirmPassword"
                onChange={(event) =>
                  update('confirmPassword', event.target.value)
                }
                required
                type="password"
                value={values.confirmPassword}
              />
              <Button
                className={styles.submit}
                fullWidth
                isPending={registration.isPending}
                size="large"
                type="submit"
              >
                {registration.isPending
                  ? 'Creating account…'
                  : 'Create account'}
              </Button>
              <Typography
                className={styles.footer}
                align="center"
                variant="caption"
              >
                <span>Already have an account? </span>
                <Link href={signInHref} onClick={navigateTo(signInHref)}>
                  Sign in
                </Link>
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function feedbackFor(error: Error): Feedback {
  if (error instanceof ApiError) {
    const { failure } = error
    if (failure.kind === 'conflict') {
      return {
        fieldErrors: {
          email:
            'An account already exists for this email address. Sign in, or use a different email address.',
        },
      }
    }
    if (failure.kind === 'validation') {
      const { email, password } = fieldErrorsByAttribute(failure.errors)
      if (email || password) {
        return {
          fieldErrors: {
            ...(email ? { email } : {}),
            ...(password ? { password } : {}),
          },
        }
      }
    }
  }
  return { fieldErrors: {}, message: formLevelMessage(error) }
}
