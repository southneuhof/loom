import type { PropType } from 'vue'

export type DatepickerTeleportTarget = boolean | string | HTMLElement

export const datepickerTeleportProp = {
  type: [Boolean, String, HTMLElement] as PropType<DatepickerTeleportTarget>,
  default: true,
}

export const datepickerPopupClass = 'pointer-events-auto'

export const datepickerPopupConfig = Object.freeze({
  allowPreventDefault: false,
  allowStopPropagation: true,
})
