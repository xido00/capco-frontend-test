import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { formDocument } from '../../test/api-fixtures'

import { answersFor, useStepDraft } from './-use-step-draft'

const form = formDocument({
  answers: { name: 'Ada', email: 'ada@example.test', city: 'London' },
  version: 7,
}).data

describe('useStepDraft', () => {
  it('starts from the saved answers of the step only', () => {
    const { result } = renderHook(() => useStepDraft(form, 'personal-details'))

    expect(result.current.draft.values).toEqual({
      name: 'Ada',
      dateOfBirth: '',
      country: '',
      nationality: '',
      email: 'ada@example.test',
      phone: '',
    })
    expect(result.current.baseVersion).toBe(7)
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('tracks unsaved changes against the saved answers', () => {
    const { result } = renderHook(() => useStepDraft(form, 'personal-details'))

    act(() => result.current.setValue('name', 'Ada King'))
    expect(result.current.hasUnsavedChanges).toBe(true)

    act(() => result.current.setValue('name', 'Ada'))
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => result.current.setConsentConfirmed(true))
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('takes the version from a save and keeps later edits unsaved', () => {
    const { result } = renderHook(() => useStepDraft(form, 'personal-details'))
    act(() => result.current.setValue('name', 'Ada King'))
    const submitted = result.current.draft

    act(() => result.current.setValue('phone', '+44'))
    act(() => result.current.markSaved(submitted, 8))

    expect(result.current.baseVersion).toBe(8)
    expect(result.current.hasSaved).toBe(true)
    expect(result.current.hasUnsavedChanges).toBe(true)
  })
})

describe('answersFor', () => {
  const draft = { values: { name: 'Ada' }, consentConfirmed: true }

  it('includes consent on the personal details step', () => {
    expect(answersFor(draft, 'personal-details')).toEqual({
      name: 'Ada',
      consentConfirmed: true,
    })
  })

  it('leaves consent out of other steps, as the API rejects it there', () => {
    expect(answersFor(draft, 'identity-and-address')).toEqual({ name: 'Ada' })
  })
})
