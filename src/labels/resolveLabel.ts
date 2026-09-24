import type { Label, LabelDictionary } from '../contracts/labels'

export function resolveLabel(key: string, override?: Label | null, labels?: LabelDictionary): string {
  const dictionaryLabel = labels && Object.hasOwn(labels, key) ? labels[key] : undefined
  const label = override ?? dictionaryLabel ?? key
  return typeof label === 'function' ? label() : label
}
