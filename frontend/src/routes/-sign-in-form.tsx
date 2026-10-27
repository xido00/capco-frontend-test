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
import styles from './account-access.module.css'

export interface SignInFormProps {
  onNavigate?: (href: string) => void
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

export function SignInForm({
  onNavigate,
  returnTo,
  onSuccess,
}: SignInFormProps) {
  const [values, setValues] = useState<SignInValues>({
    email: '',
    password: '',
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const { fieldErrors, setFieldErrors, showFeedback, summaryProps } =
    useFormFeedback(fieldIds)
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
    if (signIn.isPending) {
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
          // The API only returns local journey paths; guard against open redirects anyway.
          onSuccess(isSafeJourneyPath(href) ? href : defaultJourney)
        },
        onError: (error) => {
          if (isInvalidCredentials(error)) {
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
              <Link
                href={createAccountHref}
                onClick={(event) => {
                  if (onNavigate) {
                    event.preventDefault()
                    onNavigate(createAccountHref)
                  }
                }}
              >
                Create account
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}

function isInvalidCredentials(error: Error): boolean {
  return error instanceof ApiError && error.failure.kind === 'unauthorized'
}

function feedbackFor(error: Error): FormFeedback<SignInField> {
  if (isInvalidCredentials(error)) {
    return { fieldErrors: {}, message: invalidCredentialsMessage }
  }
  if (error instanceof ApiError && error.failure.kind === 'validation') {
    const { email, password } = fieldErrorsByAttribute(error.failure.errors)
    if (email || password) {
      return {
        fieldErrors: {
          ...(email ? { email } : {}),
          ...(password ? { password } : {}),
        },
      }
    }
  }
  return { fieldErrors: {}, message: formLevelMessage(error) }
}
