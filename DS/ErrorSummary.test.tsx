import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { ErrorSummary } from './ErrorSummary'

expect.extend(toHaveNoViolations)

describe('ErrorSummary', () => {
  it('renders nothing without errors', () => {
    const { container } = render(<ErrorSummary />)

    expect(container).toBeEmptyDOMElement()
  })

  it('announces a form-level message and field errors', () => {
    render(
      <ErrorSummary
        message="Too many attempts. Try again in 30 seconds."
        errors={[{ fieldId: 'email', message: 'Enter an email address.' }]}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('There is a problem')
    expect(alert).toHaveTextContent(
      'Too many attempts. Try again in 30 seconds.',
    )
    expect(
      screen.getByRole('link', { name: 'Enter an email address.' }),
    ).toHaveAttribute('href', '#email')
  })

  it('moves focus to the field when its error link is activated', async () => {
    render(
      <>
        <ErrorSummary
          errors={[{ fieldId: 'email', message: 'Enter an email address.' }]}
        />
        <label htmlFor="email">Email address</label>
        <input id="email" />
      </>,
    )

    await userEvent.click(
      screen.getByRole('link', { name: 'Enter an email address.' }),
    )

    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('exposes a focusable container that holds the alert', () => {
    const ref = createRef<HTMLDivElement>()
    render(<ErrorSummary ref={ref} message="Something went wrong." />)

    ref.current?.focus()

    expect(ref.current).toHaveFocus()
    expect(ref.current).toContainElement(screen.getByRole('alert'))
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(
      <ErrorSummary
        message="Check your connection and try again."
        errors={[{ fieldId: 'email', message: 'Enter an email address.' }]}
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
