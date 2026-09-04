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

export type RendererSurface = 'table' | 'detail' | 'form'

export interface RendererRegistry {
  register: (key: string, renderer: Component) => void
  get: (key: string) => Component | undefined
  /** Throws with the available keys, which beats a silently blank cell. */
  require: (key: string) => Component
  has: (key: string) => boolean
  keys: () => string[]
}

export type RendererRegistries = Record<RendererSurface, RendererRegistry>

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

export interface RendererRegistriesInput {
  table?: Record<string, Component>
  detail?: Record<string, Component>
  form?: Record<string, Component>
}

export function createRendererRegistries(input: RendererRegistriesInput = {}): RendererRegistries {
  return {
    table: createRendererRegistry('table', input.table),
    detail: createRendererRegistry('detail', input.detail),
    form: createRendererRegistry('form', { ...builtInFormRenderers, ...input.form }),
  }
}

export const rendererRegistriesKey: InjectionKey<RendererRegistries> = Symbol.for('loom-renderers')

export function useRendererRegistries(): RendererRegistries {
  const registries = inject(rendererRegistriesKey)
  if (!registries) throw new Error('[loom] FrameworkPlugin is not installed.')
  return registries
}

export function useRendererRegistry(surface: RendererSurface): RendererRegistry {
  return useRendererRegistries()[surface]
}
