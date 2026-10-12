import type { AriaAttributes } from 'vue'

export interface BaseInputControlBindings {
  readonly id: string
  readonly disabled: boolean
  readonly required: boolean
  readonly 'aria-describedby'?: string
  readonly 'aria-invalid'?: AriaAttributes['aria-invalid']
  readonly 'aria-required'?: AriaAttributes['aria-required']
}
