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
import { useReportUnsavedChanges } from './-unsaved-changes'

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

interface Draft {
  values: Partial<Record<TextAnswerName, string>>
  consentConfirmed: boolean
}

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
  const [draft, setDraft] = useState(() => draftFrom(form, step))
  // What the API last confirmed; the draft differs from it while edits are unsaved.
  const [savedDraft, setSavedDraft] = useState(draft)
  // The version these edits are based on. Background refetches update the
  // query cache, but saving must still detect changes made since the edits began.
  const [baseVersion, setBaseVersion] = useState(form.attributes.version)
  const [hasSaved, setHasSaved] = useState(false)
  const [intent, setIntent] = useState<SaveIntent>('save')
  const [hasConflict, setHasConflict] = useState(false)
  const { showFeedback, summaryProps } = useFormFeedback(noFieldIds)
  const hasUnsavedChanges = !sameDraft(draft, savedDraft)
  const reportUnsavedChanges = useReportUnsavedChanges(hasUnsavedChanges)
  const save = useMutation({
    mutationFn: (answers: ApplicationAnswers) =>
      saveApplicationForm(applicationId, {
        step,
        answers,
        version: baseVersion,
      }),
  })

  const savingIntent = save.isPending ? intent : undefined

  function updateDraft(change: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...change }))
  }

  function submit(nextIntent: SaveIntent) {
    if (save.isPending) {
      return
    }
    setIntent(nextIntent)
    const submitted = draft
    const answers: ApplicationAnswers = { ...submitted.values }
    if (step === 'personal-details') {
      answers.consentConfirmed = submitted.consentConfirmed
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
        // Edits made while the request was in flight stay unsaved.
        setSavedDraft(submitted)
        setBaseVersion(saved.attributes.version)
        setHasConflict(false)
        setHasSaved(true)
        showFeedback({ fieldErrors: {} })
        if (nextIntent === 'continue') {
          // Navigating now must not be blocked by the pre-save state.
          reportUnsavedChanges(false)
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
            setDraft((current) => ({
              ...current,
              values: { ...current.values, [field.name]: value },
            }))
          }}
          type={field.type ?? 'text'}
          value={draft.values[field.name] ?? ''}
        />
      ))}
      {step === 'personal-details' ? (
        <Checkbox
          isSelected={draft.consentConfirmed}
          name="consentConfirmed"
          onChange={(isSelected) =>
            updateDraft({ consentConfirmed: isSelected })
          }
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
        {saveStatusText(hasUnsavedChanges, hasSaved)}
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

function saveStatusText(hasUnsavedChanges: boolean, hasSaved: boolean) {
  if (hasUnsavedChanges) {
    return 'You have unsaved changes.'
  }
  return hasSaved ? 'Your answers have been saved.' : ''
}

function draftFrom(form: ApplicationForm, step: ApplicationStep): Draft {
  const { answers } = form.attributes
  return {
    values: Object.fromEntries(
      stepFields[step].map(({ name }) => [name, answers[name] ?? '']),
    ),
    consentConfirmed: answers.consentConfirmed ?? false,
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.consentConfirmed === b.consentConfirmed &&
    Object.entries(a.values).every(
      ([name, value]) => b.values[name as TextAnswerName] === value,
    )
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
