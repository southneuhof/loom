export type DateEditableValue = Date | null | undefined
export type DateControlValue = string | null | undefined

export interface DateControlValueAdapter {
  toControl(value: DateEditableValue, withTime: boolean, field: string): DateControlValue
  toEditable(value: DateControlValue, field: string): DateEditableValue
}

function invalidDateValue(field: string): never {
  throw new Error(`[loom][FORM_CONTROL_VALUE_INVALID] Form field "${field}" expects a valid date value.`)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateToControl(value: DateEditableValue, withTime: boolean, field: string): DateControlValue {
  if (value === null || value === undefined) return value
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return invalidDateValue(field)
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  if (!withTime) return date
  return `${date} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

function controlToDate(value: DateControlValue, field: string): DateEditableValue {
  if (value === null || value === undefined || value === '') return value === undefined ? undefined : null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value)
  if (!match) return invalidDateValue(field)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
    || date.getSeconds() !== second
  ) return invalidDateValue(field)
  return date
}

export const dateControlValueAdapter: DateControlValueAdapter = {
  toControl: dateToControl,
  toEditable: controlToDate,
}
