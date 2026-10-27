import { Alert, Button, ConfirmDialog, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, redirect, useBlocker, useNavigate } from 'react-router'

import { ApiError } from '../api/api-error'
import { signOut } from '../api/applications'
import { queryClient } from '../query-client'

import { accountAccessHref, isSafeJourneyPath } from './-return-target'
import { currentApplicationQuery } from './applications/-queries'
import { isSessionExpired } from './applications/-session'
import styles from './applications-layout.module.css'

import type { Route } from './+types/applications'
import type { ApplicationsOutletContext } from './applications/-unsaved-changes'

/**
 * Keeps signed-out visitors out of the Applicant area. The API has no
 * "who am I" endpoint, so the current-application read doubles as the
 * session check; its result is cached for the page that needs it.
 */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  try {
    await queryClient.fetchQuery(currentApplicationQuery())
  } catch (error) {
    if (isSessionExpired(error)) {
      const { pathname, search } = new URL(request.url)
      const returnTo = `${pathname}${search}`
      // Same rule sign-in applies: only journey pages are worth returning to.
      throw redirect(
        accountAccessHref(
          '/sign-in',
          isSafeJourneyPath(returnTo) ? returnTo : undefined,
        ),
      )
    }
    // Other failures do not prove the visitor is signed out; pages show them with a retry.
  }
  return null
}

export default function ApplicationsLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // A ref, not state: a page clears it right before navigating after a save,
  // and the blocker must see that immediately.
  const hasUnsavedChanges = useRef(false)
  const [isSignOutPending, setSignOutPending] = useState(false)
  const outletContext = useMemo<ApplicationsOutletContext>(
    () => ({
      reportUnsavedChanges: (value) => {
        hasUnsavedChanges.current = value
      },
    }),
    [],
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges.current &&
      currentLocation.pathname !== nextLocation.pathname,
  )
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSettled: (_, error) => {
      // 401 means the session is already gone, which is what signing out wants.
      const signedOut =
        !error ||
        (error instanceof ApiError && error.failure.kind === 'unauthorized')
      if (signedOut) {
        // Never show one Applicant's cached answers to the next person.
        queryClient.clear()
        void navigate('/sign-in')
      }
    },
  })

  useEffect(() => {
    // Reloading or closing the tab: let the browser ask.
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [])

  function requestSignOut() {
    if (hasUnsavedChanges.current) {
      setSignOutPending(true)
    } else {
      signOutMutation.mutate()
    }
  }

  function discardChangesAndContinue() {
    hasUnsavedChanges.current = false
    if (isSignOutPending) {
      setSignOutPending(false)
      signOutMutation.mutate()
    } else {
      blocker.proceed?.()
    }
  }

  function stay() {
    setSignOutPending(false)
    blocker.reset?.()
  }

  return (
    <>
      <header className={styles.header}>
        <Typography component="p" variant="subheading">
          KYC Application
        </Typography>
        <Button
          isPending={signOutMutation.isPending}
          onPress={requestSignOut}
          size="small"
          variant="secondary"
        >
          {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
        </Button>
      </header>
      {signOutMutation.isError ? (
        <Alert className={styles.alert} severity="error">
          We could not sign you out. Check your connection and try again.
        </Alert>
      ) : null}
      <Outlet context={outletContext} />
      <ConfirmDialog
        isOpen={blocker.state === 'blocked' || isSignOutPending}
        title={
          isSignOutPending
            ? 'Sign out without saving?'
            : 'Leave without saving?'
        }
        confirmLabel={
          isSignOutPending ? 'Sign out without saving' : 'Leave without saving'
        }
        cancelLabel="Stay on this page"
        onConfirm={discardChangesAndContinue}
        onCancel={stay}
      >
        Your latest changes on this page have not been saved. If you continue,
        they will be lost.
      </ConfirmDialog>
    </>
  )
}
