import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it } from 'vitest'

import { TextField } from './Primitives'

expect.extend(toHaveNoViolations)

describe('TextField', () => {
  it('keeps the description and adds the error message to the accessible description', () => {
    render(
      <TextField
        label="Password"
        description="Use at least six characters."
        errorMessage="Enter a password."
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Password' })

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Use at least six characters. Enter a password.',
    )
  })

  it('is valid without an error message', () => {
    render(<TextField label="Email address" description="Work email" />)
    const input = screen.getByRole('textbox', { name: 'Email address' })

    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).toHaveAccessibleDescription('Work email')
  })

  it('marks required fields for assistive technology without native validation', () => {
    render(<TextField label="Email address" required />)
    const input = screen.getByRole('textbox', { name: 'Email address' })

    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).not.toHaveAttribute('required')
  })

  it('uses the given id for the input so labels and links can target it', () => {
    render(<TextField id="applicant-email" label="Email address" />)

    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'applicant-email')
  })

  it('has no automated accessibility violations when invalid', async () => {
    const { container } = render(
      <TextField
        label="Email address"
        description="We will contact you here."
        errorMessage="Enter a valid email address."
        required
      />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
