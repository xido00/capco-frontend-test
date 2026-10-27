import { Link } from '@kyc/ui'

import { accountAccessHref } from '../-return-target'
import { ApiError } from '../../api/api-error'

/** The API rejected the request because there is no active Applicant session. */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.failure.kind === 'unauthorized'
}

/**
 * Explains an expired session and links to sign-in, returning to `pathname`.
 * After sign-in the API sends the Applicant to their current step.
 */
export function SessionExpiredMessage({
  pathname,
  unsavedChanges = false,
}: {
  pathname: string
  unsavedChanges?: boolean
}) {
  return (
    <>
      Your session has expired.{' '}
      {unsavedChanges
        ? 'Your latest changes on this page were not saved. '
        : ''}
      <Link href={accountAccessHref('/sign-in', pathname)}>Sign in again</Link>{' '}
      to continue.
    </>
  )
}
