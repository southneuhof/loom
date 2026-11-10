export function normalizeQueryFilters(filters: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}
