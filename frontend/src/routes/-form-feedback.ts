import { useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

import type { ErrorSummaryFieldError } from '@kyc/ui'

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>

export interface FormFeedback<Field extends string> {
  fieldErrors: FieldErrors<Field>
  /** Error not tied to a field. */
  message?: ReactNode
}

/**
 * Error state shared by account access forms: inline field errors, plus an
 * error summary that keeps the last submit's errors and receives focus.
 */
export function useFormFeedback<Field extends string>(
  fieldIds: Record<Field, string>,
) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<Field>>({})
  // Snapshot from the last submit: the summary is a live region, so it must not change while typing.
  const [summary, setSummary] = useState<FormFeedback<Field>>()
  const summaryRef = useRef<HTMLDivElement>(null)

  function showFeedback(feedback: FormFeedback<Field>) {
    flushSync(() => {
      setFieldErrors(feedback.fieldErrors)
      setSummary(feedback)
    })
    summaryRef.current?.focus()
  }

  const summaryErrors: ErrorSummaryFieldError[] = (
    Object.keys(fieldIds) as Field[]
  ).flatMap((field) => {
    const message = summary?.fieldErrors[field]
    return message ? [{ fieldId: fieldIds[field], message }] : []
  })

  return {
    fieldErrors,
    setFieldErrors,
    showFeedback,
    summaryProps: {
      ref: summaryRef,
      message: summary?.message,
      errors: summaryErrors,
    },
  }
}
