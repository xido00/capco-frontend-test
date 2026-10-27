import { Alert, Button, Typography } from '@kyc/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'

import { formLevelMessage } from '../-account-access-feedback'
import { isSafeJourneyPath } from '../-return-target'
import {
  startApplication,
  type CurrentApplication,
} from '../../api/applications'

import {
  ApplicantJourneyPresentation,
  type ApplicantJourneyProgressItem,
} from './-applicant-journey-presentation'
import { ApplicationPageState } from './-application-page-state'
import { applicationQueryKeys, currentApplicationQuery } from './-queries'
import { isSessionExpired, SessionExpiredMessage } from './-session'

const pageTitle = 'Your KYC application'

const startProgress: ApplicantJourneyProgressItem[] = [
  { step: 'personal-details', state: 'current' },
  { step: 'identity-and-address', state: 'remaining' },
]

export function meta() {
  return [{ title: `${pageTitle} – KYC` }]
}

export default function CurrentApplicationJourneyPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const current = useQuery(currentApplicationQuery())
  const start = useMutation({
    mutationFn: startApplication,
    onSuccess: (application) => {
      queryClient.setQueryData(applicationQueryKeys.current, application)
      continueAt(application)
    },
  })

  function continueAt(application: CurrentApplication) {
    // The API only returns local journey paths; refuse anything else.
    if (isSafeJourneyPath(application.attributes.href)) {
      void navigate(application.attributes.href)
    }
  }

  if (current.isPending) {
    return (
      <ApplicationPageState title={pageTitle}>
        <Typography role="status">Loading your application…</Typography>
      </ApplicationPageState>
    )
  }

  if (current.isError) {
    return (
      <ApplicationPageState title={pageTitle}>
        {isSessionExpired(current.error) ? (
          <Alert severity="error">
            <SessionExpiredMessage pathname={pathname} />
          </Alert>
        ) : (
          <>
            <Alert severity="error">
              We could not load your application.{' '}
              {formLevelMessage(current.error)}
            </Alert>
            <Button onPress={() => void current.refetch()}>Try again</Button>
          </>
        )}
      </ApplicationPageState>
    )
  }

  const application = current.data
  return (
    <ApplicantJourneyPresentation
      entryState={application ? 'resume' : 'start'}
      progress={
        application
          ? toProgress(application.attributes.progress)
          : startProgress
      }
      isPending={start.isPending}
      errorMessage={
        start.isError ? (
          <StartErrorMessage error={start.error} pathname={pathname} />
        ) : undefined
      }
      onPrimaryAction={() => {
        if (application) {
          continueAt(application)
        } else {
          start.mutate()
        }
      }}
    />
  )
}

function StartErrorMessage({
  error,
  pathname,
}: {
  error: Error
  pathname: string
}) {
  if (isSessionExpired(error)) {
    return <SessionExpiredMessage pathname={pathname} />
  }
  return <>We could not start your application. {formLevelMessage(error)}</>
}

function toProgress(
  progress: CurrentApplication['attributes']['progress'],
): ApplicantJourneyProgressItem[] {
  return progress.map(({ step, state }) => ({
    step,
    state: state === 'not-started' ? 'remaining' : state,
  }))
}
