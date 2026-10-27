import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

expect.extend(toHaveNoViolations)

function renderDialog() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      isOpen
      title="Leave without saving?"
      confirmLabel="Leave without saving"
      cancelLabel="Stay on this page"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      Your changes on this page have not been saved.
    </ConfirmDialog>,
  )
  return { user: userEvent.setup(), onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('is a named alert dialog with focus on the safe choice', () => {
    renderDialog()

    expect(
      screen.getByRole('alertdialog', { name: 'Leave without saving?' }),
    ).toHaveTextContent('Your changes on this page have not been saved.')
    expect(
      screen.getByRole('button', { name: 'Stay on this page' }),
    ).toHaveFocus()
  })

  it('reports the chosen action', async () => {
    const { user, onConfirm, onCancel } = renderDialog()

    await user.click(
      screen.getByRole('button', { name: 'Leave without saving' }),
    )

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('treats Escape as cancel', async () => {
    const { user, onConfirm, onCancel } = renderDialog()

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('has no automated accessibility violations', async () => {
    renderDialog()

    expect(await axe(screen.getByRole('alertdialog'))).toHaveNoViolations()
  })
})
