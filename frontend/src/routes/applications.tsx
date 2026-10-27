import { Alert, Button, Typography } from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Outlet, useNavigate } from 'react-router'

import { ApiError } from '../api/api-error'
import { signOut } from '../api/applications'

import styles from './applications-layout.module.css'

export default function ApplicationsLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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

  return (
    <>
      <header className={styles.header}>
        <Typography component="p" variant="subheading">
          KYC Application
        </Typography>
        <Button
          isPending={signOutMutation.isPending}
          onPress={() => signOutMutation.mutate()}
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
      <Outlet />
    </>
  )
}
