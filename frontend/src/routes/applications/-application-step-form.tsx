import {
  Button,
  Checkbox,
  ErrorSummary,
  Stack,
  TextField,
  Typography,
} from '@kyc/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { formLevelMessage } from '../-account-access-feedback'
import { useFormFeedback } from '../-form-feedback'
import { ApiError } from '../../api/api-error'
import {
  saveApplicationForm,
  type ApplicationAnswers,
  type ApplicationForm,
  type ApplicationStep,
} from '../../api/applications'
import styles from '../application-step.module.css'

import { applicationQueryKeys } from './-queries'
import { isSessionExpired, SessionExpiredMessage } from './-session'
import { stepFields, type TextAnswerName } from './-step-fields'

export interface ApplicationStepFormProps {
  applicationId: string
  step: ApplicationStep
  /** Saved form state; the form copies it once and then owns the edits. */
  form: ApplicationForm
  pathname: string
  onBack: () => void
  /** Called after "Save and continue" succeeds. */
  onContinue: () => void
  /** Discards local edits and loads the latest saved answers. */
  onReload: () => void
}

type SaveIntent = 'save' | 'continue'
type SaveState = 'idle' | 'saved' | 'changed'

const noFieldIds: Record<never, string> = {}

export function ApplicationStepForm({
  applicationId,
  step,
  form,
  pathname,
  onBack,
  onContinue,
  onReload,
}: ApplicationStepFormProps) {
  const queryClient = useQueryClient()
  const fields = stepFields[step]
  const [values, setValues] = useState(() => initialValues(form, step))
  const [consentConfirmed, setConsentConfirmed] = useState(
    form.attributes.answers.consentConfirmed ?? false,
  )
  // The version these edits are based on. Background refetches update the
  // query cache, but saving must still detect changes made since the edits began.
  const [baseVersion, setBaseVersion] = useState(form.attributes.version)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [intent, setIntent] = useState<SaveIntent>('save')
  const [hasConflict, setHasConflict] = useState(false)
  const { showFeedback, summaryProps } = useFormFeedback(noFieldIds)
  const save = useMutation({
    mutationFn: (answers: ApplicationAnswers) =>
      saveApplicationForm(applicationId, {
        step,
        answers,
        version: baseVersion,
      }),
  })

  const savingIntent = save.isPending ? intent : undefined

  function markChanged() {
    if (saveState === 'saved') {
      setSaveState('changed')
    }
  }

  function submit(nextIntent: SaveIntent) {
    if (save.isPending) {
      return
    }
    setIntent(nextIntent)
    const answers: ApplicationAnswers = { ...values }
    if (step === 'personal-details') {
      answers.consentConfirmed = consentConfirmed
    }
    save.mutate(answers, {
      onSuccess: (saved) => {
        queryClient.setQueryData(
          applicationQueryKeys.form(applicationId),
          saved,
        )
        // Progress on the journey page depends on the saved answers.
        void queryClient.invalidateQueries({
          queryKey: applicationQueryKeys.current,
        })
        setBaseVersion(saved.attributes.version)
        setHasConflict(false)
        setSaveState('saved')
        showFeedback({ fieldErrors: {} })
        if (nextIntent === 'continue') {
          onContinue()
        }
      },
      onError: (error) => {
        const conflict =
          error instanceof ApiError && error.failure.kind === 'conflict'
        setHasConflict(conflict)
        showFeedback({
          fieldErrors: {},
          message: saveErrorMessage(error, pathname),
        })
      },
    })
  }

  return (
    <Stack
      component="form"
      className={styles.stepForm}
      onSubmit={(event) => {
        event.preventDefault()
        submit('continue')
      }}
      spacing={2}
    >
      <ErrorSummary {...summaryProps} title="Your answers were not saved" />
      {hasConflict ? (
        <Button variant="secondary" onPress={onReload}>
          Reload saved answers
        </Button>
      ) : null}
      {fields.map((field) => (
        <TextField
          autoComplete={field.autoComplete ?? 'off'}
          description={field.description}
          fullWidth
          id={`answer-${field.name}`}
          key={field.name}
          label={field.label}
          name={field.name}
          onChange={(event) => {
            const { value } = event.target
            setValues((current) => ({ ...current, [field.name]: value }))
            markChanged()
          }}
          type={field.type ?? 'text'}
          value={values[field.name] ?? ''}
        />
      ))}
      {step === 'personal-details' ? (
        <Checkbox
          isSelected={consentConfirmed}
          name="consentConfirmed"
          onChange={(isSelected) => {
            setConsentConfirmed(isSelected)
            markChanged()
          }}
        >
          I confirm these details are accurate and belong to me.
        </Checkbox>
      ) : (
        <Typography tone="muted">
          {form.attributes.documentEvidence.present
            ? 'An identity document image is saved with this application.'
            : 'No identity document image has been uploaded yet.'}
        </Typography>
      )}
      <Typography className={styles.saveStatus} role="status">
        {saveStatusText[saveState]}
      </Typography>
      <Stack
        component="div"
        className={styles.formActions}
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
      >
        <Button type="button" variant="quiet" onPress={onBack}>
          Back
        </Button>
        <Stack component="div" direction={{ xs: 'column', sm: 'row' }}>
          <Button
            isPending={savingIntent === 'save'}
            onPress={() => submit('save')}
            variant="secondary"
          >
            {savingIntent === 'save' ? 'Saving…' : 'Save'}
          </Button>
          <Button isPending={savingIntent === 'continue'} type="submit">
            {savingIntent === 'continue' ? 'Saving…' : 'Save and continue'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  )
}

const saveStatusText: Record<SaveState, string> = {
  idle: '',
  saved: 'Your answers have been saved.',
  changed: 'You have unsaved changes.',
}

function initialValues(
  form: ApplicationForm,
  step: ApplicationStep,
): Partial<Record<TextAnswerName, string>> {
  const { answers } = form.attributes
  return Object.fromEntries(
    stepFields[step].map(({ name }) => [name, answers[name] ?? '']),
  )
}

function saveErrorMessage(error: Error, pathname: string): ReactNode {
  // 403 means the CSRF token or session no longer matches: same remedy as 401.
  if (
    isSessionExpired(error) ||
    (error instanceof ApiError && error.failure.kind === 'forbidden')
  ) {
    return <SessionExpiredMessage pathname={pathname} unsavedChanges />
  }
  if (error instanceof ApiError) {
    switch (error.failure.kind) {
      case 'conflict':
        return 'This application was changed in another window or on another device. Reload the saved answers to continue. Your changes on this page will be replaced.'
      case 'validation':
        return 'Some answers could not be accepted. Check your answers and try again.'
      case 'not-found':
        return 'This application is no longer available.'
      default:
        break
    }
  }
  return formLevelMessage(error)
}
