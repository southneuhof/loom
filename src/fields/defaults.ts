import { inject, type InjectionKey } from 'vue'
import type { FieldCatalog, FieldDefinition } from '../contracts'
import { mergeFieldLayers, type FieldLayer } from './resolve'

export type FrameworkSurfaceDefaults = Omit<FieldLayer, 'props' | 'source'>

export interface FrameworkFieldDefaultsInput {
  shared?: FrameworkSurfaceDefaults
  table?: FrameworkSurfaceDefaults
  detail?: FrameworkSurfaceDefaults
  form?: FrameworkSurfaceDefaults
  /** App-owned defaults selected by normalized field key. */
  fields?: FieldCatalog
}

export interface ResolvedFrameworkFieldDefaults {
  table: FieldLayer
  detail: FieldLayer
  form: FieldLayer
  fields: FieldCatalog
}

export const frameworkFieldDefaultsKey: InjectionKey<ResolvedFrameworkFieldDefaults> =
  Symbol.for('loom-field-defaults')

export function resolveFrameworkFieldDefaults(
  input: FrameworkFieldDefaultsInput = {},
): ResolvedFrameworkFieldDefaults {
  return {
    table: mergeFieldLayers([input.shared, input.table]),
    detail: mergeFieldLayers([input.shared, input.detail]),
    form: mergeFieldLayers([input.shared, input.form]),
    fields: Object.fromEntries(
      Object.entries(input.fields ?? {}).map(([key, definition]) => [
        key,
        cloneFieldDefinition(definition),
      ]),
    ),
  }
}

function cloneFieldDefinition(definition: FieldDefinition): FieldDefinition {
  const cloneProjection = <T extends object>(projection: T | undefined): T | undefined => {
    if (!projection) return projection
    return {
      ...projection,
      ...('props' in projection && projection.props
        ? { props: { ...(projection.props as Record<string, unknown>) } }
        : {}),
    }
  }
  const cloneSurface = <T extends object>(projection: T | false | undefined): T | false | undefined =>
    projection === false ? false : cloneProjection(projection)

  return {
    ...definition,
    display: cloneProjection(definition.display),
    table: cloneSurface(definition.table),
    detail: cloneSurface(definition.detail),
    form: cloneSurface(definition.form),
  }
}

export function useFrameworkFieldDefaults(): ResolvedFrameworkFieldDefaults {
  const defaults = inject(frameworkFieldDefaultsKey)
  if (!defaults) throw new Error('[loom] FrameworkPlugin is not installed.')
  return defaults
}
