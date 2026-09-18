/**
 * Renderer registries.
 *
 * Field config stores a stable `renderer` key plus serializable options; the
 * implementation is an ordinary Vue component held here. Renderer contexts
 * carry value, record or draft, field identity, and editing state — never
 * routes, permission stores, or resource operations.
 */
import { inject, type Component, type InjectionKey } from 'vue'
import { builtInFormRenderers } from './form'
import type { FormRendererComponents } from './formContracts'

export type RendererSurface = 'table' | 'detail' | 'form'

export interface RendererRegistry {
  register: (key: string, renderer: Component) => void
  get: (key: string) => Component | undefined
  /** Throws with the available keys, which beats a silently blank cell. */
  require: (key: string) => Component
  has: (key: string) => boolean
  keys: () => string[]
}

/**
 * Form renderer registry. The key selects the component type from the
 * augmentable component map, so registration under a misspelled key fails.
 * The renderer stays a plain component; no prop check runs here.
 */
export interface FormRendererRegistry extends Omit<RendererRegistry, 'register'> {
  register<K extends keyof FormRendererComponents & string>(
    key: K,
    renderer: FormRendererComponents[K] | Component,
  ): void
}

export interface RendererRegistries {
  table: RendererRegistry
  detail: RendererRegistry
  form: FormRendererRegistry
}

export function createRendererRegistry(
  surface: 'table' | 'detail',
  initial?: Record<string, Component>,
): RendererRegistry
export function createRendererRegistry(
  surface: 'form',
  initial?: FormRendererRegistriesInput,
): FormRendererRegistry
export function createRendererRegistry(
  surface: RendererSurface,
  initial: Record<string, Component> = {},
): RendererRegistry {
  const renderers = new Map<string, Component>(Object.entries(initial))

  return {
    register: (key, renderer) => void renderers.set(key, renderer),
    get: (key) => renderers.get(key),
    has: (key) => renderers.has(key),
    keys: () => [...renderers.keys()],
    require: (key) => {
      const renderer = renderers.get(key)
      if (!renderer) {
        throw new Error(
          `[loom] No ${surface} renderer registered for "${key}". Registered: ${[...renderers.keys()].join(', ') || 'none'}.`,
        )
      }
      return renderer
    },
  }
}

/**
 * Form renderer entries keyed by the augmentable component map. Each entry
 * accepts its declared component type or any plain component (for example a
 * runtime wrapper); an undeclared key fails.
 */
export type FormRendererRegistriesInput = {
  [K in keyof FormRendererComponents]?: FormRendererComponents[K] | Component
}

export interface RendererRegistriesInput {
  table?: Record<string, Component>
  detail?: Record<string, Component>
  form?: FormRendererRegistriesInput
}

export function createRendererRegistries(input: RendererRegistriesInput = {}): RendererRegistries {
  return {
    table: createRendererRegistry('table', input.table),
    detail: createRendererRegistry('detail', input.detail),
    form: createRendererRegistry('form', input.form ? { ...builtInFormRenderers, ...input.form } : { ...builtInFormRenderers }),
  }
}

export const rendererRegistriesKey: InjectionKey<RendererRegistries> = Symbol.for('loom-renderers')

export function useRendererRegistries(): RendererRegistries {
  const registries = inject(rendererRegistriesKey)
  if (!registries) throw new Error('[loom] FrameworkPlugin is not installed.')
  return registries
}

export function useRendererRegistry(surface: 'table' | 'detail'): RendererRegistry
export function useRendererRegistry(surface: 'form'): FormRendererRegistry
export function useRendererRegistry(surface: RendererSurface): RendererRegistry | FormRendererRegistry {
  return useRendererRegistries()[surface]
}
