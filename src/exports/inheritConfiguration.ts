const inheritedBags = ['labels', 'context', 'query', 'searchParameters', 'actionLabels'] as const
function bag(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
}
export function inheritExportConfiguration<T extends object>(source: T, patch?: object): T {
  const result = { ...source, ...patch }
  for (const key of inheritedBags) {
    const base = Reflect.get(source, key)
    const override = patch && Reflect.get(patch, key)
    if (bag(base) && bag(override)) Reflect.set(result, key, { ...base, ...override })
  }
  return result
}
