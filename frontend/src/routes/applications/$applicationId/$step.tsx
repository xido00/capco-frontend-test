import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@kyc/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { data, useLocation, useNavigate } from 'react-router'

import { ApplicationPageState } from '../-application-page-state'
import { ApplicationStepForm } from '../-application-step-form'
import { applicationFormQuery } from '../-queries'
import { isSessionExpired, SessionExpiredMessage } from '../-session'
import { isApplicationStep, stepOrder, stepTitles } from '../-step-fields'
import { formLevelMessage } from '../../-account-access-feedback'
import { ApiError } from '../../../api/api-error'
import styles from '../../application-step.module.css'

import type { Route } from './+types/$step'

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (params.step !== 'review' && !isApplicationStep(params.step)) {
    throw data(null, { status: 404 })
  }
  return null
}

export function meta({ params }: Route.MetaArgs) {
  const title = isApplicationStep(params.step)
    ? stepTitles[params.step]
    : 'Review application'
  return [{ title: `${title} – KYC` }]
}

export default function ApplicationStepPage({ params }: Route.ComponentProps) {
  if (!isApplicationStep(params.step)) {
    return <ReviewPrototype applicationId={params.applicationId} />
  }
  return <StepPage applicationId={params.applicationId} step={params.step} />
}

function StepPage({
  applicationId,
  step,
}: {
  applicationId: string
  step: (typeof stepOrder)[number]
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const form = useQuery(applicationFormQuery(applicationId))
  // Remounts the form so a reload replaces local edits with the saved answers.
  const [revision, setRevision] = useState(0)
  const stepIndex = stepOrder.indexOf(step)
  const title = stepTitles[step]

  if (form.isPending) {
    return (
      <ApplicationPageState title={title}>
        <Typography role="status">Loading your saved answers…</Typography>
      </ApplicationPageState>
    )
  }

  if (form.isError) {
    return (
      <ApplicationPageState title={title}>
        <LoadError
          error={form.error}
          pathname={pathname}
          onRetry={() => void form.refetch()}
        />
      </ApplicationPageState>
    )
  }

  const nextStep = stepOrder[stepIndex + 1]
  const previousStep = stepOrder[stepIndex - 1]
  return (
    <main className={styles.page}>
      <Box component="div" className={styles.stepContent}>
        <Stack spacing={3}>
          <Typography component="p" variant="eyebrow" tone="accent">
            Step {stepIndex + 1} of {stepOrder.length}
          </Typography>
          <Typography component="h1" variant="heading">
            {title}
          </Typography>
          <Typography tone="muted">
            Every field is needed before you can submit your application. You
            can save your progress at any time and come back later.
          </Typography>
          <ApplicationStepForm
            key={`${step}-${revision}`}
            applicationId={applicationId}
            step={step}
            form={form.data}
            pathname={pathname}
            onBack={() =>
              void navigate(
                previousStep
                  ? `/applications/${applicationId}/${previousStep}`
                  : '/applications/current',
              )
            }
            onContinue={() =>
              void navigate(
                `/applications/${applicationId}/${nextStep ?? 'review'}`,
              )
            }
            onReload={() => {
              void form.refetch().then(() => setRevision((count) => count + 1))
            }}
          />
        </Stack>
      </Box>
    </main>
  )
}

function LoadError({
  error,
  pathname,
  onRetry,
}: {
  error: Error
  pathname: string
  onRetry: () => void
}) {
  if (isSessionExpired(error)) {
    return (
      <Alert severity="error">
        <SessionExpiredMessage pathname={pathname} />
      </Alert>
    )
  }
  if (error instanceof ApiError && error.failure.kind === 'not-found') {
    return (
      <Alert severity="error">
        We could not find this application.{' '}
        <Link href="/applications/current">Go to your application</Link>.
      </Alert>
    )
  }
  return (
    <>
      <Alert severity="error">
        We could not load your saved answers. {formLevelMessage(error)}
      </Alert>
      <Button onPress={onRetry}>Try again</Button>
    </>
  )
}

/** Submission is out of scope for TICKET-003; this prototype page is unchanged. */
function ReviewPrototype({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate()
  return (
    <main className={styles.reviewPage}>
      <Card className={styles.reviewCard}>
        <CardContent>
          <Stack spacing={2}>
            <Typography component="h1" variant="heading">
              Review application
            </Typography>
            <Typography>Your application is ready for review.</Typography>
            <label>
              <input type="checkbox" /> I confirm the information is complete
              and accurate.
            </label>
            <Button
              onClick={() =>
                void navigate(`/applications/${applicationId}/submitted`)
              }
            >
              Submit
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigate(
                  `/applications/${applicationId}/identity-and-address`,
                )
              }
            >
              Return to form
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
