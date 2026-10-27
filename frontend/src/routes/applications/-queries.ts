import { queryOptions } from '@tanstack/react-query'

import {
  getApplicationForm,
  getCurrentApplication,
} from '../../api/applications'

export const applicationQueryKeys = {
  all: ['applications'] as const,
  current: ['applications', 'current'] as const,
  form: (applicationId: string) =>
    ['applications', applicationId, 'form'] as const,
}

export function currentApplicationQuery() {
  return queryOptions({
    queryKey: applicationQueryKeys.current,
    queryFn: ({ signal }) => getCurrentApplication(signal),
    // Fresh long enough for the page to reuse the layout's session check
    // instead of requesting it again; saves invalidate it explicitly.
    staleTime: 10_000,
  })
}

export function applicationFormQuery(applicationId: string) {
  return queryOptions({
    queryKey: applicationQueryKeys.form(applicationId),
    queryFn: ({ signal }) => getApplicationForm(applicationId, signal),
    // Lets the page reuse the route loader's fetch. Edits are protected by the
    // version sent on save, not by how fresh this cache entry is.
    staleTime: 10_000,
  })
}
