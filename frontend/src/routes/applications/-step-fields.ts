import type {
  ApplicationAnswers,
  ApplicationStep,
} from '../../api/applications'

export type TextAnswerName = Exclude<
  keyof ApplicationAnswers,
  'consentConfirmed'
>

export interface StepField {
  name: TextAnswerName
  label: string
  description?: string
  type?: 'text' | 'email' | 'tel'
  /** Checked before saving; empty values are allowed in a draft. */
  format?: 'date'
  /** Lets browsers and assistive tools fill in personal data (WCAG 1.3.5). */
  autoComplete?: string
}

const dateHint = 'For example, 1990-04-27'

export const stepFields: Record<ApplicationStep, readonly StepField[]> = {
  'personal-details': [
    { name: 'name', label: 'Name', autoComplete: 'name' },
    {
      name: 'dateOfBirth',
      label: 'Date of birth',
      description: dateHint,
      format: 'date',
      autoComplete: 'bday',
    },
    { name: 'country', label: 'Country', autoComplete: 'country-name' },
    { name: 'nationality', label: 'Nationality' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' },
  ],
  'identity-and-address': [
    { name: 'documentType', label: 'Document type' },
    { name: 'documentNumber', label: 'Document number' },
    { name: 'documentCountry', label: 'Document country' },
    {
      name: 'expiry',
      label: 'Expiry',
      description: dateHint,
      format: 'date',
    },
    { name: 'street', label: 'Street', autoComplete: 'street-address' },
    { name: 'city', label: 'City', autoComplete: 'address-level2' },
    { name: 'postal', label: 'Postal code', autoComplete: 'postal-code' },
    {
      name: 'residentialCountry',
      label: 'Residential country',
      autoComplete: 'country-name',
    },
  ],
}

export const stepTitles: Record<ApplicationStep, string> = {
  'personal-details': 'Personal details',
  'identity-and-address': 'Identity and address',
}

export const stepOrder: readonly ApplicationStep[] = [
  'personal-details',
  'identity-and-address',
]

export function isApplicationStep(value: string): value is ApplicationStep {
  return (stepOrder as readonly string[]).includes(value)
}

/** Error for one field, or undefined when its value can be saved. */
export function validateStepField(
  field: StepField,
  value: string,
): string | undefined {
  if (field.format === 'date' && value.trim() && !isIsoDate(value.trim())) {
    return `Enter ${field.label.toLowerCase()} as a real date in the format YYYY-MM-DD, like 1990-04-27`
  }
  return undefined
}

export function validateStepValues(
  step: ApplicationStep,
  values: Partial<Record<TextAnswerName, string>>,
): Partial<Record<TextAnswerName, string>> {
  return Object.fromEntries(
    stepFields[step].flatMap((field) => {
      const message = validateStepField(field, values[field.name] ?? '')
      return message ? [[field.name, message]] : []
    }),
  )
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  // Rejects dates that do not exist, such as 2024-02-30.
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}
