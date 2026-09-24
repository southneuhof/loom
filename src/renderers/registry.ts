import { inject, type Component, type InjectionKey } from 'vue'
import { builtInFormRenderers } from './form'
import type { FormRendererComponents } from './formContracts'
import type { DisplayRendererComponents } from './displayContracts'

export type RendererSurface = 'form' | 'display'

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

export interface DisplayRendererRegistry extends Omit<RendererRegistry, 'register'> {
  register<K extends keyof DisplayRendererComponents & string>(
    key: K,
    renderer: DisplayRendererComponents[K],
  ): void
}

export interface RendererRegistries {
  form: FormRendererRegistry
  display: DisplayRendererRegistry
}

export function createRendererRegistry(
  surface: 'form',
  initial?: FormRendererRegistriesInput,
): FormRendererRegistry
export function createRendererRegistry(
  surface: 'display',
  initial?: DisplayRendererRegistriesInput,
): DisplayRendererRegistry
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
          `[loom][RENDERER_NOT_REGISTERED] No ${surface} renderer registered for "${key}". Registered: ${[...renderers.keys()].join(', ') || 'none'}.`,
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

export type DisplayRendererRegistriesInput = {
  [K in keyof DisplayRendererComponents]?: DisplayRendererComponents[K]
}

export interface RendererRegistriesInput {
  form?: FormRendererRegistriesInput
  display?: DisplayRendererRegistriesInput
}

export function createRendererRegistries(input: RendererRegistriesInput = {}): RendererRegistries {
  return {
    form: createRendererRegistry('form', input.form ? { ...builtInFormRenderers, ...input.form } : { ...builtInFormRenderers }),
    display: createRendererRegistry('display', input.display),
  }
}

export const rendererRegistriesKey: InjectionKey<RendererRegistries> = Symbol.for('loom-renderers')

export function useRendererRegistries(): RendererRegistries {
  const registries = inject(rendererRegistriesKey)
  if (!registries) throw new Error('[loom] FrameworkPlugin is not installed.')
  return registries
}

export function useRendererRegistry(surface: 'form'): FormRendererRegistry
export function useRendererRegistry(surface: 'display'): DisplayRendererRegistry
export function useRendererRegistry(surface: RendererSurface): RendererRegistry | FormRendererRegistry | DisplayRendererRegistry {
  return useRendererRegistries()[surface]
}
