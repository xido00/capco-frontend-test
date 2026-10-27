import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: ReactNode
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  /** Also called on Escape, so dismissing never confirms. */
  onCancel: () => void
}

/**
 * Modal alert dialog for decisions that discard work. Focus starts on the
 * safe choice (cancel), is trapped while open and returns afterwards.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalOverlay
      className={styles.overlay}
      isDismissable={false}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
    >
      <Modal className={styles.modal}>
        <Dialog className={styles.dialog} role="alertdialog">
          <Heading className={styles.title} slot="title">
            {title}
          </Heading>
          <div className={styles.body}>{children}</div>
          <div className={styles.actions}>
            <Button autoFocus onPress={onCancel} variant="secondary">
              {cancelLabel}
            </Button>
            <Button onPress={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
