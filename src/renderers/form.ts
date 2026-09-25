import { defineAsyncComponent } from 'vue'
import FileInput from '../components/inputs/FileInput.vue'
import TextInput from '../components/inputs/TextInput.vue'
import type { BuiltInFormRendererComponents } from './formContracts'

export const builtInFormRenderers: Record<keyof BuiltInFormRendererComponents, unknown> = {
  text: TextInput,
  textarea: defineAsyncComponent(() => import('../components/inputs/TextareaInput.vue')),
  password: defineAsyncComponent(() => import('../components/inputs/PasswordInput.vue')),
  number: defineAsyncComponent(() => import('../components/inputs/NumberInput.vue')),
  select: defineAsyncComponent(() => import('../components/inputs/SelectInput.vue')),
  radio: defineAsyncComponent(() => import('../components/inputs/RadioGroupInput.vue')),
  date: defineAsyncComponent(() => import('../components/inputs/DateInput.vue')),
  daterange: defineAsyncComponent(() => import('../components/inputs/DateRangeInput.vue')),
  month: defineAsyncComponent(() => import('../components/inputs/MonthInput.vue')),
  year: defineAsyncComponent(() => import('../components/inputs/YearInput.vue')),
  time: defineAsyncComponent(() => import('../components/inputs/TimeInput.vue')),
  checkbox: defineAsyncComponent(() => import('../components/inputs/CheckboxInput.vue')),
  'checkbox-group': defineAsyncComponent(() => import('../components/inputs/CheckboxGroupInput.vue')),
  switch: defineAsyncComponent(() => import('../components/inputs/Switch.vue')),
  file: FileInput,
  image: defineAsyncComponent(() => import('../components/inputs/ImageInput.vue')),
  tag: defineAsyncComponent(() => import('../components/inputs/TagInput.vue')),
  color: defineAsyncComponent(() => import('../components/inputs/ColorInput.vue')),
  lookup: defineAsyncComponent(() => import('../components/composites/form-inputs/LookupInput.vue')),
  location: defineAsyncComponent(() => import('../components/composites/form-inputs/LocationInput.vue')),
  'multi-location': defineAsyncComponent(() => import('../components/composites/form-inputs/MultiLocationInput.vue')),
  'rich-text': defineAsyncComponent(() => import('../components/inputs/RichTextInput.vue')),
  'icon-select': defineAsyncComponent(() => import('../components/inputs/IconSelectInput.vue')),
  table: defineAsyncComponent(() => import('../components/composites/form-inputs/TableInput.vue')),
  separator: defineAsyncComponent(() => import('../components/composites/form-inputs/FormSeparator.vue')),
  canvas: defineAsyncComponent(() => import('../components/inputs/DrawingCanvas.vue')),
}
