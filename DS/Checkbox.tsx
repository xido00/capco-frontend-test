import { Checkbox as AriaCheckbox } from 'react-aria-components'

import styles from './Checkbox.module.css'

import type { ReactNode } from 'react'

export interface CheckboxProps {
  children: ReactNode
  isSelected: boolean
  onChange: (isSelected: boolean) => void
  id?: string
  name?: string
  isRequired?: boolean
  isDisabled?: boolean
  className?: string
}

/** Labelled checkbox; the whole label is the click target. */
export function Checkbox({
  children,
  className,
  isRequired,
  ...props
}: CheckboxProps) {
  return (
    <AriaCheckbox
      {...props}
      isRequired={isRequired}
      // Applications own validation; never show native browser bubbles.
      validationBehavior="aria"
      className={[styles.checkbox, className].filter(Boolean).join(' ')}
    >
      {({ isSelected }) => (
        <>
          <span aria-hidden="true" className={styles.box}>
            {isSelected ? (
              <svg viewBox="0 0 16 16" className={styles.check}>
                <polyline points="3 8.5 6.5 12 13 4.5" />
              </svg>
            ) : null}
          </span>
          <span>{children}</span>
        </>
      )}
    </AriaCheckbox>
  )
}
