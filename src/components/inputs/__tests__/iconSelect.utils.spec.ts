import { describe, expect, it } from 'vitest'
import {
  extractRemixiconClassNamesFromStyleSheets,
  filterRemixiconClassNames,
  normalizeRemixiconClass,
  toIconRows,
} from '../iconSelect.utils'

describe('iconSelect utils', () => {
  it('extracts and deduplicates remixicon classes from stylesheet rules', () => {
    const styleSheet = {
      cssRules: [
        { selectorText: '.ri-home-line::before' },
        { selectorText: '.ri-home-fill::before, .ri-bank-line::before' },
        {
          cssRules: [{ selectorText: '.ri-home-line::before' }, { selectorText: '.ri-arrow-right-line::before' }],
        },
      ],
    } as unknown as CSSStyleSheet

    expect(extractRemixiconClassNamesFromStyleSheets([styleSheet])).toEqual([
      'ri-arrow-right-line',
      'ri-bank-line',
      'ri-home-fill',
      'ri-home-line',
    ])
  })

  it('ignores unreadable stylesheets', () => {
    const blocked = {
      get cssRules() {
        throw new Error('SecurityError')
      },
    } as unknown as CSSStyleSheet

    const allowed = {
      cssRules: [{ selectorText: '.ri-store-line::before' }],
    } as unknown as CSSStyleSheet

    expect(extractRemixiconClassNamesFromStyleSheets([blocked, allowed])).toEqual(['ri-store-line'])
  })

  it('filters icons case-insensitively', () => {
    const icons = ['ri-home-line', 'ri-home-fill', 'ri-bank-line', 'ri-arrow-right-line']
    expect(filterRemixiconClassNames(icons, 'HOME')).toEqual(['ri-home-line', 'ri-home-fill'])
    expect(filterRemixiconClassNames(icons, 'arrow-right')).toEqual(['ri-arrow-right-line'])
    expect(filterRemixiconClassNames(icons, '')).toEqual(icons)
  })

  it('builds rows for virtualized grid', () => {
    expect(toIconRows(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('normalizes model values to full remixicon classes', () => {
    expect(normalizeRemixiconClass('ri-home-line')).toBe('ri-home-line')
    expect(normalizeRemixiconClass('ri-home-fill')).toBe('ri-home-fill')
    expect(normalizeRemixiconClass('home')).toBe('')
    expect(normalizeRemixiconClass('')).toBe('')
  })
})
