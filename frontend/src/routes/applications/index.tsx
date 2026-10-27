import { redirect } from 'react-router'

/** `/applications` has no page of its own; the journey starts at the current draft. */
export function clientLoader() {
  return redirect('/applications/current')
}

export default function ApplicationsIndex() {
  return null
}
