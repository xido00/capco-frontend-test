import { Card, CardContent, Stack, Typography } from '@kyc/ui'

import styles from '../applicant-journey.module.css'

import type { ReactNode } from 'react'

/** Page shell for loading and error states of the Applicant journey. */
export function ApplicationPageState({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <CardContent className={styles.cardContent}>
          <Stack spacing={2}>
            <Typography component="h1" variant="heading">
              {title}
            </Typography>
            {children}
          </Stack>
        </CardContent>
      </Card>
    </main>
  )
}
