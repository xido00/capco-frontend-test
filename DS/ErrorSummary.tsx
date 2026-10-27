import styles from './ErrorSummary.module.css'

import type { ReactNode, Ref } from 'react'

export interface ErrorSummaryFieldError {
  /** Id of the invalid input; the message links to it and focuses it. */
  fieldId: string
  message: ReactNode
}

export interface ErrorSummaryProps {
  /** Error not tied to a field, such as a network or rate limit failure. */
  message?: ReactNode
  errors?: readonly ErrorSummaryFieldError[]
  title?: ReactNode
  /** Forms move focus here after a failed submit. */
  ref?: Ref<HTMLDivElement>
}

/**
 * Lists form errors at the top of a form, following the GOV.UK error summary
 * pattern: focusable container, announced content, links that focus each field.
 * The container has no accessible name: ARIA prohibits naming a generic element,
 * and the inner alert already announces the title and messages.
 */
export function ErrorSummary({
  message,
  errors = [],
  title = 'There is a problem',
  ref,
}: ErrorSummaryProps) {
  if (!message && errors.length === 0) {
    return null
  }
  return (
    <div ref={ref} className={styles.summary} tabIndex={-1}>
      <div role="alert">
        <h2 className={styles.title}>{title}</h2>
        {Boolean(message) && <p className={styles.message}>{message}</p>}
        {errors.length > 0 && (
          <ul className={styles.list}>
            {errors.map(({ fieldId, message: fieldMessage }) => (
              <li key={fieldId}>
                <a
                  className={styles.link}
                  href={`#${fieldId}`}
                  onClick={(event) => {
                    const field = document.getElementById(fieldId)
                    if (field) {
                      event.preventDefault()
                      field.focus()
                    }
                  }}
                >
                  {fieldMessage}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
