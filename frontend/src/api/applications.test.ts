import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  apiPaths,
  applicationId,
  formDocument,
  jsonApiResponse,
} from '../test/api-fixtures'
import { server } from '../test/server'

import {
  getApplicationForm,
  getCurrentApplication,
  saveApplicationForm,
} from './applications'
import { jsonApiMediaType } from './client'

const formPath = apiPaths.form()
const savedForm = formDocument({
  answers: { name: 'Ada Lovelace' },
  version: 4,
})

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
        apiPaths.currentApplication,
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
        return jsonApiResponse(savedForm)
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
        return jsonApiResponse(savedForm)
      }),
    )

    await getApplicationForm(applicationId)

    expect(captured?.headers.get('X-XSRF-TOKEN')).toBeNull()
  })

  it('rethrows aborts so cancelled queries are not reported as failures', async () => {
    server.use(http.get(formPath, () => jsonApiResponse(savedForm)))
    const controller = new AbortController()
    controller.abort()

    await expect(
      getApplicationForm(applicationId, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
