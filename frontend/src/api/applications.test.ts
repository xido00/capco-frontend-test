import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { server } from '../test/server'

import {
  getApplicationForm,
  getCurrentApplication,
  saveApplicationForm,
} from './applications'
import { jsonApiMediaType } from './client'

const applicationId = '0199a8bb-8687-7c22-aed5-55d432f50f23'
const formPath = `/api/v1/applicant-applications/${applicationId}/form`

const formDocument = {
  data: {
    type: 'applicant-application-forms',
    id: applicationId,
    attributes: {
      status: 'draft',
      currentStep: 'personal-details',
      steps: [],
      answers: { name: 'Ada Lovelace' },
      documentEvidence: { present: false },
      version: 4,
    },
  },
}

function setCookie(value: string) {
  document.cookie = value
}

describe('applications API', () => {
  beforeEach(() => setCookie('XSRF-TOKEN=csrf%20token; path=/'))
  afterEach(() =>
    setCookie('XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'),
  )

  it('returns null when the Applicant has no draft', async () => {
    server.use(
      http.get(
        '/api/v1/applicant-applications/current',
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    expect(await getCurrentApplication()).toBeNull()
  })

  it('sends the CSRF token and the step document when saving', async () => {
    let captured: Request | undefined
    server.use(
      http.patch(formPath, ({ request }) => {
        captured = request.clone()
        return HttpResponse.json(formDocument, {
          headers: { 'Content-Type': jsonApiMediaType },
        })
      }),
    )

    const form = await saveApplicationForm(applicationId, {
      step: 'personal-details',
      answers: { name: 'Ada Lovelace' },
      version: 3,
    })

    expect(form.attributes.version).toBe(4)
    expect(captured?.headers.get('X-XSRF-TOKEN')).toBe('csrf token')
    expect(captured?.headers.get('Content-Type')).toBe(jsonApiMediaType)
    expect(await captured?.json()).toEqual({
      data: {
        type: 'applicant-application-forms',
        id: applicationId,
        attributes: {
          step: 'personal-details',
          answers: { name: 'Ada Lovelace' },
          version: 3,
        },
      },
    })
  })

  it('does not send the CSRF token on reads', async () => {
    let captured: Request | undefined
    server.use(
      http.get(formPath, ({ request }) => {
        captured = request
        return HttpResponse.json(formDocument)
      }),
    )

    await getApplicationForm(applicationId)

    expect(captured?.headers.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('rethrows aborts so cancelled queries are not reported as failures', async () => {
    server.use(http.get(formPath, () => HttpResponse.json(formDocument)))
    const controller = new AbortController()
    controller.abort()

    await expect(
      getApplicationForm(applicationId, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
