import { describe, expect, it, vi } from 'vitest'
import NumberInput from '../NumberInput.vue'
import { mountInput } from './harness'

describe('NumberInput', () => {
  it('mounts with prefix, currency, and default placeholder without DOM attribute errors or Vue warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const mounted = mountInput(NumberInput, {
      model: 42.5,
      props: {
        label: 'Unit cost',
        currency: 'USD',
        prefix: '$',
        locale: 'en-US',
      },
    })

    try {
      const root = mounted.host.firstElementChild as HTMLElement
      const input = mounted.host.querySelector('input') as HTMLInputElement
      expect(root.hasAttribute('prefix')).toBe(false)
      expect(root.hasAttribute('currency')).toBe(false)
      expect(input.value).toBe('42.5')
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally {
      mounted.cleanup()
      warn.mockRestore()
      error.mockRestore()
    }
  })
})
