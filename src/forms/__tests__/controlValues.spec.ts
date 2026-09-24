import { describe, expect, it } from 'vitest'
import { dateControlValueAdapter } from '../controlValues'

describe('date control values', () => {
  it('round-trips local date and date-time values', () => {
    const date = new Date(2026, 8, 23, 14, 7, 9)
    const dateValue = dateControlValueAdapter.toControl(date, false, 'dueDate')
    const dateTimeValue = dateControlValueAdapter.toControl(date, true, 'dueAt')

    expect(dateValue).toBe('2026-09-23')
    expect(dateTimeValue).toBe('2026-09-23 14:07:09')
    expect(dateControlValueAdapter.toEditable(dateValue, 'dueDate')).toEqual(new Date(2026, 8, 23))
    expect(dateControlValueAdapter.toEditable(dateTimeValue, 'dueAt')).toEqual(date)
  })

  it('rejects invalid date control values with a field-specific diagnostic', () => {
    expect(() => dateControlValueAdapter.toEditable('2026-02-30', 'dueDate'))
      .toThrow('[loom][FORM_CONTROL_VALUE_INVALID] Form field "dueDate"')
  })
})
