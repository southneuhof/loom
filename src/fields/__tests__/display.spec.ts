import { describe, expect, it } from 'vitest'
import { displayValue } from '../display'

describe('field display values', () => {
  it('applies configured formats after reading the field value', () => {
    expect(displayValue(
      { total: 1234 },
      { key: 'total', label: 'Total', props: {}, format: 'number' },
    )).toBe('1.234')
  })

  it('formats accessor values and preserves unformatted values', () => {
    const record = { nested: { name: 'Pemohon' } }

    expect(displayValue(record, {
      key: 'name',
      label: 'Name',
      props: {},
      read: (value) => (value.nested as { name: string }).name,
    })).toBe('Pemohon')
  })
})
