import { describe, expect, it } from 'vitest'
import { computed, reactive } from 'vue'
import { resolveLabel } from '../resolveLabel'

describe('resolveLabel', () => {
  it('uses entry override, dictionary entry, then key while preserving empty strings', () => {
    const labels = { name: 'Name', empty: '' }

    expect(resolveLabel('name', 'Override', labels)).toBe('Override')
    expect(resolveLabel('name', undefined, labels)).toBe('Name')
    expect(resolveLabel('empty', undefined, labels)).toBe('')
    expect(resolveLabel('missing', undefined, labels)).toBe('missing')
  })

  it('evaluates label getters in the active reactive context', () => {
    const state = reactive({ label: 'Initial' })
    const label = computed(() => resolveLabel('status', undefined, { status: () => state.label }))

    expect(label.value).toBe('Initial')
    state.label = 'Updated'
    expect(label.value).toBe('Updated')
  })
})
