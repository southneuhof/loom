/**
 * Core-compatible adapters for framework input components.
 *
 * Existing inputs speak Vue's `modelValue` contract while core Form exposes
 * `value` and `setValue`. Keep that compatibility boundary here so resource
 * forms and project overrides share one renderer registry.
 */
import { defineAsyncComponent, defineComponent, h, type Component } from 'vue'
import { twMerge } from 'tailwind-merge'
import FileInput from '../components/inputs/FileInput.vue'

const coreTextRenderer = defineComponent({
  name: 'CoreTextRenderer',
  inheritAttrs: false,
  props: {
    value: { type: null, default: undefined },
    setValue: { type: Function, required: true },
    disabled: Boolean,
    error: String,
    id: String,
  },
  emits: ['validation:touch'],
  setup(props, { attrs, emit }) {
    return () => {
      const { class: className, ...inputAttrs } = attrs
      return h('div', {
        class: twMerge(
          'flex min-h-12 items-center rounded-lg bg-transparent px-4 py-3 text-on-surface outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus-within:outline-secondary focus-within:ring-1 focus-within:ring-secondary/30',
          props.error ? 'outline-error focus-within:outline-error focus-within:ring-error/30' : '',
          props.disabled ? 'cursor-not-allowed text-on-surface-variant opacity-60' : '',
          className as string | undefined,
        ),
      }, h('input', {
        ...inputAttrs,
        id: props.id,
        value: props.value ?? '',
        disabled: props.disabled,
        class: 'min-w-0 w-full bg-transparent text-inherit outline-none placeholder:text-on-surface-variant focus-visible:outline-none disabled:cursor-not-allowed',
        onInput: (event: Event) => props.setValue((event.target as HTMLInputElement).value),
        onBlur: () => emit('validation:touch'),
      }))
    }
  },
})

export function adaptVModelInput(input: Component): Component {
  return defineComponent({
    name: 'ControlledFormInputAdapter',
    inheritAttrs: false,
    props: {
      value: { type: null, default: undefined },
      setValue: { type: Function, required: true },
      disabled: Boolean,
      error: String,
      id: String,
      draft: { type: Object, default: undefined },
      field: { type: Object, default: undefined },
      touched: Boolean,
      validating: Boolean,
      formValidating: Boolean,
    },
    emits: ['validation:touch'],
    setup(props, { attrs, emit }) {
      return () => h(input, {
        ...attrs,
        id: props.id,
        disabled: props.disabled,
        error: props.error,
        modelValue: props.value,
        'onUpdate:modelValue': (value: unknown) => props.setValue(value),
        'onValidation:touch': () => emit('validation:touch'),
      })
    },
  })
}

function controlledInput(loader: () => Promise<{ default: Component }>): Component {
  return adaptVModelInput(defineAsyncComponent(loader))
}

/** Stable built-in renderer keys. Applications may override any entry. */
export const builtInFormRenderers: Record<string, Component> = {
  text: coreTextRenderer,
  textarea: controlledInput(() => import('../components/inputs/TextareaInput.vue')),
  password: controlledInput(() => import('../components/inputs/PasswordInput.vue')),
  number: controlledInput(() => import('../components/inputs/NumberInput.vue')),
  currency: controlledInput(() => import('../components/inputs/NumberInput.vue')),
  select: controlledInput(() => import('../components/inputs/SelectInput.vue')),
  radio: controlledInput(() => import('../components/inputs/RadioGroupInput.vue')),
  date: controlledInput(() => import('../components/inputs/DateInput.vue')),
  daterange: controlledInput(() => import('../components/inputs/DateRangeInput.vue')),
  month: controlledInput(() => import('../components/inputs/MonthInput.vue')),
  year: controlledInput(() => import('../components/inputs/YearInput.vue')),
  time: controlledInput(() => import('../components/inputs/TimeInput.vue')),
  checkbox: controlledInput(() => import('../components/inputs/CheckboxInput.vue')),
  'checkbox-group': controlledInput(() => import('../components/inputs/CheckboxGroupInput.vue')),
  switch: controlledInput(() => import('../components/inputs/Switch.vue')),
  file: adaptVModelInput(FileInput),
  image: controlledInput(() => import('../components/inputs/ImageInput.vue')),
  tag: controlledInput(() => import('../components/inputs/TagInput.vue')),
  color: controlledInput(() => import('../components/inputs/ColorInput.vue')),
  lookup: controlledInput(() => import('../components/composites/form-inputs/LookupInput.vue')),
  location: controlledInput(() => import('../components/composites/form-inputs/LocationInput.vue')),
  'multi-location': controlledInput(() => import('../components/composites/form-inputs/MultiLocationInput.vue')),
  'rich-text': controlledInput(() => import('../components/inputs/RichTextInput.vue')),
  'icon-select': controlledInput(() => import('../components/inputs/IconSelectInput.vue')),
  table: controlledInput(() => import('../components/composites/form-inputs/TableInput.vue')),
  separator: controlledInput(() => import('../components/composites/form-inputs/FormSeparator.vue')),
  canvas: controlledInput(() => import('../components/inputs/DrawingCanvas.vue')),
}
