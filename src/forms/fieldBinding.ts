import { cloneEditable, snapshotEditable } from './draftValues'

export interface RuntimeFieldBinding {
  readonly keys: readonly string[]
  readonly read: (values: Readonly<Record<string, unknown>>) => unknown
  readonly write: (value: unknown) => unknown
}

export function bindingFor(input: object): RuntimeFieldBinding | undefined {
  return Reflect.get(input, 'binding') as RuntimeFieldBinding | undefined
}

export function fieldKeys(key: string, input: object): readonly string[] {
  return bindingFor(input)?.keys ?? [key]
}

export function formFieldValue(key: string, input: object, draft: object): unknown {
  const binding = bindingFor(input)
  if (!binding) return snapshotEditable(Reflect.get(draft, key))
  return snapshotEditable(binding.read(snapshotEditable(draft) as Readonly<Record<string, unknown>>))
}

export function fieldPatch(key: string, input: object, value: unknown): Record<string, unknown> {
  const binding = bindingFor(input)
  if (!binding) return { [key]: cloneEditable(value) }
  if (value == null) return Object.fromEntries(binding.keys.map((name) => [name, null]))
  const patch = binding.write(snapshotEditable(value))
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length !== binding.keys.length || binding.keys.some((name) => !Object.hasOwn(patch, name))) {
    throw new Error(`[loom][FORM_BINDING_WRITE] Form field "${key}" binding.write must return exactly: ${binding.keys.join(', ')}.`)
  }
  return cloneEditable(patch) as Record<string, unknown>
}
