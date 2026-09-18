import { inject, type InjectionKey } from 'vue'
import type { FieldCatalog, FieldDefinition } from '../contracts'
import type { FormRendererComponents, FormRendererProps } from '../renderers/formContracts'
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

/** Guard that rejects known renderer props with the wrong declared type. */
export type FrameworkFieldDefaultsGuard<TInput> = TInput extends { fields?: infer TFields }
  ? TFields extends Record<string, infer TDefinition>
    ? TDefinition extends { form?: infer TForm }
      ? TForm extends false | undefined ? unknown
        : TForm extends { renderer: infer TRenderer }
          ? TRenderer extends keyof FormRendererComponents
            ? TForm extends { props?: infer TProps }
              ? TProps extends FormRendererProps<TRenderer & keyof FormRendererComponents> ? unknown : never
              : unknown
            : unknown
          : unknown
      : unknown
    : unknown
  : unknown

export function resolveFrameworkFieldDefaults<TInput extends FrameworkFieldDefaultsInput>(
  input: TInput & FrameworkFieldDefaultsGuard<TInput> = {} as TInput & FrameworkFieldDefaultsGuard<TInput>,
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
