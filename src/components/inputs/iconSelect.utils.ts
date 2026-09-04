const ICON_SELECTOR_REGEX = /\.((?:ri-[a-z0-9-]+-(?:line|fill)))::before\b/gi

function collectIconClassesFromRule(rule: CSSRule, out: Set<string>) {
  const asStyleRule = rule as CSSStyleRule
  if (typeof asStyleRule.selectorText === 'string') {
    let match: RegExpExecArray | null
    ICON_SELECTOR_REGEX.lastIndex = 0
    while ((match = ICON_SELECTOR_REGEX.exec(asStyleRule.selectorText)) !== null) {
      out.add(match[1])
    }
  }

  const asGroupingRule = rule as CSSGroupingRule
  if (asGroupingRule.cssRules) {
    for (const nestedRule of Array.from(asGroupingRule.cssRules)) {
      collectIconClassesFromRule(nestedRule, out)
    }
  }
}

export function extractRemixiconClassNamesFromStyleSheets(styleSheets: Iterable<CSSStyleSheet>): string[] {
  const icons = new Set<string>()

  for (const sheet of styleSheets) {
    try {
      const rules = sheet.cssRules
      for (const rule of Array.from(rules)) {
        collectIconClassesFromRule(rule, icons)
      }
    } catch {
      // Some stylesheets are cross-origin and throw when reading cssRules.
      continue
    }
  }

  return Array.from(icons).sort((a, b) => a.localeCompare(b))
}

export function filterRemixiconClassNames(icons: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return icons
  return icons.filter((icon) => icon.toLowerCase().includes(normalizedQuery))
}

export function toIconRows(icons: string[], columns: number): string[][] {
  if (columns <= 0) return []

  const rows: string[][] = []
  for (let i = 0; i < icons.length; i += columns) {
    rows.push(icons.slice(i, i + columns))
  }
  return rows
}

export function normalizeRemixiconClass(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  return /^ri-[a-z0-9-]+-(line|fill)$/.test(trimmed) ? trimmed : ''
}
