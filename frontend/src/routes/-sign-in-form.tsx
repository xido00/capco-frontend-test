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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, fieldErrorsByAttribute } from '../api/api-error'
import { createApplicantSession } from '../api/applicant-access'

import { formLevelMessage } from './-account-access-feedback'
import {
  validateSignIn,
  type SignInField,
  type SignInValues,
} from './-applicant-credentials'
import { useFormFeedback, type FormFeedback } from './-form-feedback'
import { accountAccessHref, isSafeJourneyPath } from './-return-target'
import { useRetryAfter } from './-use-retry-after'
import styles from './account-access.module.css'

export interface SignInFormProps {
  returnTo?: string
  /** Receives the journey URL to continue at after the session is established. */
  onSuccess: (href: string) => void
}

const fieldIds: Record<SignInField, string> = {
  email: 'applicant-email',
  password: 'applicant-password',
}

// Same message for unknown emails and wrong passwords, as the API intends.
const invalidCredentialsMessage =
  'The email address or password is incorrect. Check them and try again.'
const defaultJourney = '/applications/current'

export function SignInForm({ returnTo, onSuccess }: SignInFormProps) {
  const [values, setValues] = useState<SignInValues>({
    email: '',
    password: '',
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const { fieldErrors, setFieldErrors, showFeedback, summaryProps } =
    useFormFeedback(fieldIds)
  const queryClient = useQueryClient()
  const retryAfter = useRetryAfter()
  const signIn = useMutation({ mutationFn: createApplicantSession })
  const createAccountHref = accountAccessHref('/create-account', returnTo)

  function update(field: SignInField, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (hasSubmitted) {
      setFieldErrors((current) => ({
        ...current,
        [field]: validateSignIn(next)[field],
      }))
    }
  }

  function submit() {
    if (signIn.isPending || retryAfter.isWaiting) {
      return
    }
    setHasSubmitted(true)
    const errors = validateSignIn(values)
    if (Object.keys(errors).length > 0) {
      showFeedback({ fieldErrors: errors })
      return
    }
    signIn.mutate(
      { email: values.email.trim(), password: values.password },
      {
        onSuccess: (href) => {
          // A new session may belong to someone else: drop data cached for the previous one.
          queryClient.removeQueries()
          // The API only returns local journey paths; guard against open redirects anyway.
          onSuccess(isSafeJourneyPath(href) ? href : defaultJourney)
        },
        onError: (error) => {
          retryAfter.waitIfRateLimited(error)
          if (isRejectedCredentials(error)) {
            setValues((current) => ({ ...current, password: '' }))
          }
          showFeedback(feedbackFor(error))
        },
      },
    )
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
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
                Welcome back
              </Typography>
              <Typography tone="muted">
                Sign in to continue your KYC application.
              </Typography>
            </Stack>
            <ErrorSummary {...summaryProps} />
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
              autoComplete="current-password"
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
            <Button
              className={styles.submit}
              fullWidth
              isDisabled={retryAfter.isWaiting}
              isPending={signIn.isPending}
              size="large"
              type="submit"
            >
              {signIn.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography
              className={styles.footer}
              align="center"
              variant="caption"
            >
              <span>New to KYC? </span>
              <Link href={createAccountHref}>Create account</Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}

/**
 * Wrong credentials, including a password the API rejects for its shape: no
 * account can have such a password, so sign-in shows the same generic message
 * instead of registration's password rules.
 */
function isRejectedCredentials(error: Error): boolean {
  if (!(error instanceof ApiError)) {
    return false
  }
  const { failure } = error
  if (failure.kind === 'unauthorized') {
    return true
  }
  if (failure.kind === 'validation') {
    const { email, password } = fieldErrorsByAttribute(failure.errors)
    return !email && Boolean(password)
  }
  return false
}

function feedbackFor(error: Error): FormFeedback<SignInField> {
  if (isRejectedCredentials(error)) {
    return { fieldErrors: {}, message: invalidCredentialsMessage }
  }
  if (error instanceof ApiError && error.failure.kind === 'validation') {
    // A malformed email is safe to point out; it says nothing about accounts.
    const { email } = fieldErrorsByAttribute(error.failure.errors)
    if (email) {
      return { fieldErrors: { email } }
    }
  }
  return { fieldErrors: {}, message: formLevelMessage(error) }
}
