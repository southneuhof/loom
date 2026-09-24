type DisplayComponentConstructor = abstract new (...args: never[]) => unknown

export interface DisplayRendererComponents {}

export type DisplayRendererKey = Extract<keyof DisplayRendererComponents, string>

type ComponentProps<TComponent> = TComponent extends DisplayComponentConstructor
  ? InstanceType<TComponent> extends { $props: infer TProps } ? TProps : never
  : never

type DisplayRuntimeProp =
  | 'value'
  | 'modelValue'
  | 'model-value'
  | 'onUpdate:modelValue'
  | 'onUpdate:model-value'
  | 'record'
  | 'draft'
  | 'field'
  | 'key'
  | 'index'
  | 'setValue'
  | 'onValidation:touch'
  | 'validation:touch'

export type DisplayRendererProps<TRenderer extends DisplayRendererKey = DisplayRendererKey> =
  TRenderer extends DisplayRendererKey
    ? Omit<ComponentProps<DisplayRendererComponents[TRenderer]>, DisplayRuntimeProp>
    : never

export type DisplayRendererHasValue<TRenderer extends DisplayRendererKey> =
  'value' extends keyof ComponentProps<DisplayRendererComponents[TRenderer]> ? true : false

export type DisplayRendererValue<TRenderer extends DisplayRendererKey> =
  ComponentProps<DisplayRendererComponents[TRenderer]> extends { value?: infer TValue }
    ? TValue
    : unknown
