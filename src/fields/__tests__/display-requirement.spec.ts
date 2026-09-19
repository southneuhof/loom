import { describe, expect, it } from 'vitest'
import { requiresExplicitDisplay } from '../displayRequirement'
import type { ResolvedSurfaceField } from '../resolve'

describe('display requirement', () => {
  it('passes plain strings with the default text', () => {
    expect(requiresExplicitDisplay('string', {})).toBe(false)
  })

  it('fails numbers without display and passes with a currency format', () => {
    expect(requiresExplicitDisplay('number', {})).toBe(true)
    const resolved: ResolvedSurfaceField = { key: 'price', label: 'Price', props: {}, format: 'currency' }
    expect(requiresExplicitDisplay('number', resolved)).toBe(false)
  })

  it('fails booleans without display and passes with a chip renderer', () => {
    expect(requiresExplicitDisplay('boolean', {})).toBe(true)
    expect(requiresExplicitDisplay('boolean', { renderer: 'chip' })).toBe(false)
  })

  it('fails dates without display and passes with a date format', () => {
    expect(requiresExplicitDisplay('date', {})).toBe(true)
    expect(requiresExplicitDisplay('date', { format: 'date' })).toBe(false)
  })

  it('fails string enums without display and passes with a renderer', () => {
    const field = { props: { options: ['open', 'paid'] } }
    expect(requiresExplicitDisplay('string', field)).toBe(true)
    expect(requiresExplicitDisplay('string', { ...field, renderer: 'chip' })).toBe(false)
  })

  it('fails selections without display and passes with a format', () => {
    expect(requiresExplicitDisplay('selection[]', {})).toBe(true)
    expect(requiresExplicitDisplay('selection[]', { format: 'tag' })).toBe(false)
  })

  it('fails lookup sources without read and passes with read or renderer', () => {
    const lookup = { source: 'categories' }
    expect(requiresExplicitDisplay('string', lookup)).toBe(true)
    expect(requiresExplicitDisplay('unknown', lookup)).toBe(true)
    expect(requiresExplicitDisplay('string', { ...lookup, read: () => 'Ruas' })).toBe(false)
    expect(requiresExplicitDisplay('string', { ...lookup, renderer: 'text' })).toBe(false)
    expect(requiresExplicitDisplay('string', { ...lookup, format: 'text' })).toBe(true)
  })

  it('fails objects and arrays without read and passes with a renderer', () => {
    expect(requiresExplicitDisplay('object', {})).toBe(true)
    expect(requiresExplicitDisplay('object', { format: 'json' })).toBe(true)
    expect(requiresExplicitDisplay('object', { read: () => ({}) })).toBe(false)
    expect(requiresExplicitDisplay('array', {})).toBe(true)
    expect(requiresExplicitDisplay('object[]', { renderer: 'table' })).toBe(false)
  })

  it('passes unknown kinds without blocking', () => {
    expect(requiresExplicitDisplay('unknown', {})).toBe(false)
  })

  it('passes any kind with a read accessor', () => {
    const read = () => 'Ready'
    expect(requiresExplicitDisplay('number', { read })).toBe(false)
    expect(requiresExplicitDisplay('boolean', { read })).toBe(false)
  })
})
