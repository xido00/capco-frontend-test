import { useEffect } from 'react'
import { useOutletContext } from 'react-router'

export interface ApplicationsOutletContext {
  /** Tells the applications layout whether leaving the page would lose edits. */
  reportUnsavedChanges: (hasUnsavedChanges: boolean) => void
}

const ignore = () => {}

/**
 * Keeps the applications layout informed about unsaved edits, so it can ask
 * before navigating away or signing out. Returns the reporter for moments
 * that cannot wait for an effect, such as navigating right after a save.
 */
export function useReportUnsavedChanges(
  hasUnsavedChanges: boolean,
): (hasUnsavedChanges: boolean) => void {
  // Undefined when rendered outside the layout, for example in isolated tests.
  const context = useOutletContext<ApplicationsOutletContext | undefined>()
  const report = context?.reportUnsavedChanges ?? ignore

  useEffect(() => {
    report(hasUnsavedChanges)
  }, [report, hasUnsavedChanges])

  useEffect(() => () => report(false), [report])

  return report
}
