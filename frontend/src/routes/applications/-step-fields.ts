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
    { name: 'expiry', label: 'Expiry', description: dateHint },
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
