import { useState } from 'react'

import { stepFields, type TextAnswerName } from './-step-fields'

import type {
  ApplicationAnswers,
  ApplicationForm,
  ApplicationStep,
} from '../../api/applications'

export interface StepDraft {
  values: Partial<Record<TextAnswerName, string>>
  consentConfirmed: boolean
}

/**
 * Local edits of one form step, compared with what the API last confirmed.
 *
 * `baseVersion` is the form version the edits started from. Background
 * refetches update the query cache, but a save must still send this version
 * so the API can reject it (409) if someone else changed the form meanwhile.
 */
export function useStepDraft(form: ApplicationForm, step: ApplicationStep) {
  const [draft, setDraft] = useState(() => draftFrom(form, step))
  const [savedDraft, setSavedDraft] = useState(draft)
  const [baseVersion, setBaseVersion] = useState(form.attributes.version)
  const [hasSaved, setHasSaved] = useState(false)

  return {
    draft,
    baseVersion,
    hasSaved,
    hasUnsavedChanges: !sameDraft(draft, savedDraft),
    setValue(name: TextAnswerName, value: string) {
      setDraft((current) => ({
        ...current,
        values: { ...current.values, [name]: value },
      }))
    },
    setConsentConfirmed(consentConfirmed: boolean) {
      setDraft((current) => ({ ...current, consentConfirmed }))
    },
    /**
     * Records a successful save of `submitted`; later edits stay unsaved.
     * `version` is optional in the contract; without it saves skip the conflict check.
     */
    markSaved(submitted: StepDraft, version: number | undefined) {
      setSavedDraft(submitted)
      setBaseVersion(version)
      setHasSaved(true)
    },
  }
}

/** The answers a save sends for this step; consent belongs to personal details. */
export function answersFor(
  draft: StepDraft,
  step: ApplicationStep,
): ApplicationAnswers {
  return step === 'personal-details'
    ? { ...draft.values, consentConfirmed: draft.consentConfirmed }
    : { ...draft.values }
}

function draftFrom(form: ApplicationForm, step: ApplicationStep): StepDraft {
  const { answers } = form.attributes
  return {
    values: Object.fromEntries(
      stepFields[step].map(({ name }) => [name, answers[name] ?? '']),
    ),
    consentConfirmed: answers.consentConfirmed ?? false,
  }
}

function sameDraft(a: StepDraft, b: StepDraft): boolean {
  return (
    a.consentConfirmed === b.consentConfirmed &&
    Object.entries(a.values).every(
      ([name, value]) => b.values[name as TextAnswerName] === value,
    )
  )
}
