import type { PropType } from 'vue'
import type Datepicker from '@vuepic/vue-datepicker'

export type DatepickerTeleportTarget = boolean | string | HTMLElement

type DatepickerInputSlot = Parameters<InstanceType<typeof Datepicker>['$slots']['dp-input']>[0]

export const datepickerTeleportProp = {
  type: [Boolean, String, HTMLElement] as PropType<DatepickerTeleportTarget>,
  default: true,
}

export const datepickerPopupClass = 'pointer-events-auto'

export const datepickerPopupConfig = Object.freeze({
  allowPreventDefault: false,
  allowStopPropagation: true,
})

export function datepickerInputBindings({ value, isMenuOpen, onInput, onBlur, onFocus, onKeypress, onPaste }: DatepickerInputSlot) {
  return { value, isMenuOpen, onInput, onBlur, onFocus, onKeypress, onPaste }
}

export function useDatepickerBlur(touch: () => void) {
  let modelUpdated = false

  function markModelUpdated() {
    modelUpdated = true
  }

  function handleBlur() {
    const wasUpdated = modelUpdated
    modelUpdated = false
    if (!wasUpdated) touch()
  }

  return { markModelUpdated, handleBlur }
}
