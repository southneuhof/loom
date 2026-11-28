import { describe, expect, it } from 'vitest'
import MultiLocationInput from '../form-inputs/MultiLocationInput.vue'
import { mountInput } from '../../inputs/__tests__/harness'
import type { Coordinate, LocationOperations } from '../../../contracts/location'

const operations: LocationOperations = {
  getConfig: async () => ({ apiKey: '' }),
  search: async () => [],
}

describe('MultiLocationInput', () => {
  it('renders English defaults safely with undefined modelValue and removes stops immutably without form submission', async () => {
    const mounted = mountInput(MultiLocationInput, {
      model: undefined as Coordinate[] | undefined,
      props: {
        label: 'Route stops',
        operations,
      },
    })

    try {
      expect(mounted.host.textContent).toContain('Add location')
      expect(mounted.host.textContent).toContain('No locations added yet')
      const addButton = Array.from(mounted.host.querySelectorAll('button')).find((button) => button.textContent?.includes('Add location'))
      expect(addButton?.getAttribute('type')).toBe('button')

      const initial: Coordinate[] = [
        { lat: 47.6062, lng: -122.3321 },
        { lat: 47.45, lng: -122.3088 },
      ]
      mounted.model.value = initial
      await mounted.flush()

      const removeFirst = mounted.host.querySelector('button[aria-label="Remove location 1"]') as HTMLButtonElement
      expect(removeFirst.getAttribute('type')).toBe('button')
      removeFirst.click()
      await mounted.flush()

      expect(mounted.model.value).toEqual([{ lat: 47.45, lng: -122.3088 }])
      expect(initial).toHaveLength(2)
    } finally {
      mounted.cleanup()
    }
  })
})
