import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Checkbox } from './Checkbox'

expect.extend(toHaveNoViolations)

function ControlledCheckbox() {
  const [isSelected, setSelected] = useState(false)
  return (
    <Checkbox isSelected={isSelected} onChange={setSelected} isRequired>
      I confirm these details are accurate.
    </Checkbox>
  )
}

describe('Checkbox', () => {
  it('toggles from its label and from the keyboard', async () => {
    const user = userEvent.setup()
    render(<ControlledCheckbox />)
    const checkbox = screen.getByRole('checkbox', {
      name: 'I confirm these details are accurate.',
    })

    await user.click(screen.getByText('I confirm these details are accurate.'))
    expect(checkbox).toBeChecked()

    await user.keyboard(' ')
    expect(checkbox).not.toBeChecked()
  })

  it('exposes required state without native validation', () => {
    render(<ControlledCheckbox />)
    const checkbox = screen.getByRole('checkbox')

    expect(checkbox).toHaveAttribute('aria-required', 'true')
    expect(checkbox).not.toHaveAttribute('required')
  })

  it('has no automated accessibility violations', async () => {
    const { container } = render(<ControlledCheckbox />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
