<script setup lang="ts">
import { ref, useAttrs, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import { twMerge } from 'tailwind-merge'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import type { TextInputConstraint, TextInputNativeAttributes, TextInputProps } from './textInput.types'

defineOptions({ inheritAttrs: false })

const props = defineProps<TextInputProps>()
const modelValue = defineModel<string | number | undefined>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
  (event: 'input', value: Event): void
  (event: 'change', value: Event): void
  (event: 'focus', value: FocusEvent): void
  (event: 'blur', value: FocusEvent): void
  (event: 'keydown', value: KeyboardEvent): void
  (event: 'keyup', value: KeyboardEvent): void
  (event: 'click', value: MouseEvent): void
}>()
const inputValue = ref(modelValue.value)
const attrs = useAttrs()
const defaultConstraints: readonly TextInputConstraint[] = ['decimal', 'text']
const numericConstraints = new Set<TextInputConstraint>(['number', 'integer', 'decimal'])
const constraintRegex: Record<TextInputConstraint, RegExp> = {
  number: /^[0-9\.]*$/,
  integer: /^[0-9]*$/,
  integerString: /^[0-9]*$/,
  decimal: /^[0-9\.]*$/,
  text: /^[a-zA-Z\s]*$/,
}

function checkInput(e: InputEvent) {
  const constraints = props.constraint ?? defaultConstraints
  if (constraints.length !== 1 || e.inputType !== 'insertText') return
  const constraint = constraints[0]
  if (constraint && e.data && !constraintRegex[constraint].test(e.data)) e.preventDefault()
}

watch(inputValue, () => {
  const constraints = props.constraint ?? defaultConstraints
  const constraint = constraints[0]
  if (constraints.length === 1 && constraint && numericConstraints.has(constraint)) {
    const value = inputValue.value == null ? '' : String(inputValue.value)
    if (value === '') {
      modelValue.value = undefined
      emit('validation:error', undefined)
      return
    }
    const valuePattern = constraint === 'integer' ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/
    const numericValue = Number(value)
    if (!valuePattern.test(value) || !Number.isFinite(numericValue)) {
      emit('validation:error', 'Enter a valid number.')
      return
    }
    modelValue.value = numericValue
    emit('validation:error', undefined)
    return
  }
  modelValue.value = inputValue.value
}, { flush: 'sync' })

watch(modelValue, (value) => {
  const current = inputValue.value == null ? '' : String(inputValue.value)
  const next = value == null ? '' : String(value)
  if (current === next) return
  const constraints = props.constraint ?? defaultConstraints
  const constraint = constraints[0]
  if (typeof value === 'number' && current !== '' && constraints.length === 1 && constraint && numericConstraints.has(constraint) && Number(current) === value) return
  inputValue.value = value
})

function dataAttributes(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')))
}

function nativeAttributes(): TextInputNativeAttributes {
  return {
    id: props.id,
    name: props.name,
    autocomplete: props.autocomplete,
    inputmode: props.inputmode,
    maxlength: props.maxlength,
    minlength: props.minlength,
    pattern: props.pattern,
    readonly: props.readonly,
    placeholder: props.placeholder,
    title: props.title,
    tabindex: props.tabindex,
    'aria-label': Reflect.get(props, 'ariaLabel'),
    'aria-labelledby': Reflect.get(props, 'ariaLabelledby'),
    'aria-describedby': Reflect.get(props, 'ariaDescribedby'),
    'aria-details': Reflect.get(props, 'ariaDetails'),
    'aria-errormessage': Reflect.get(props, 'ariaErrormessage'),
    'aria-invalid': Reflect.get(props, 'ariaInvalid'),
    'aria-required': Reflect.get(props, 'ariaRequired'),
    'aria-disabled': Reflect.get(props, 'ariaDisabled'),
    'aria-autocomplete': Reflect.get(props, 'ariaAutocomplete'),
    'aria-busy': Reflect.get(props, 'ariaBusy'),
    'aria-controls': Reflect.get(props, 'ariaControls'),
    'aria-current': Reflect.get(props, 'ariaCurrent'),
    'aria-expanded': Reflect.get(props, 'ariaExpanded'),
    'aria-haspopup': Reflect.get(props, 'ariaHaspopup'),
    'aria-live': Reflect.get(props, 'ariaLive'),
    'aria-atomic': Reflect.get(props, 'ariaAtomic'),
    'aria-relevant': Reflect.get(props, 'ariaRelevant'),
    'aria-owns': Reflect.get(props, 'ariaOwns'),
    'aria-roledescription': Reflect.get(props, 'ariaRoledescription'),
  }
}
</script>

<template>
  <BaseInput
    :class="$attrs.class"
    :style="$attrs.style"
    :field="props.field"
    :enable-helper-message="props.enableHelperMessage ?? false"
    :label="props.label"
    :helper-message="props.helperMessage"
    :disabled="props.disabled"
    :error="props.error"
    :required="props.required"
    @validation:touch="emit('validation:touch')"
  >
    <template #label v-if="$slots.label">
      <slot name="label"></slot>
    </template>
    <div
      :class="twMerge(`flex flex-row items-center gap-4 rounded-lg bg-transparent py-3 pl-4 outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus-within:outline-secondary focus-within:ring-1 focus-within:ring-secondary/30 ${props.error ? 'outline-error focus-within:outline-error focus-within:ring-error/30 ' : ''} ${props.disabled ? 'pointer-events-none cursor-not-allowed opacity-60 ' : ''}`)"
    >
      <Icon v-if="props.icon" :name="(props.icon as any)" />
      <p v-if="props.prefix">{{ props.prefix }}</p>
      <input
        :type="props.type ?? 'text'"
        class="w-full bg-transparent focus-visible:outline-none"
        v-bind="{ ...nativeAttributes(), ...dataAttributes() }"
        :required="props.required"
        v-model="inputValue"
        @beforeinput="(e) => checkInput(e as InputEvent)"
        @input="emit('input', $event)"
        @change="emit('change', $event)"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
        @keydown="emit('keydown', $event)"
        @keyup="emit('keyup', $event)"
        @click="emit('click', $event)"
        :disabled="props.disabled"
      />
      <p v-if="props.suffix" class="mr-4 min-w-max">{{ props.suffix }}</p>
      <div v-if="$slots.action" class="mr-4 max-h-min"><slot name="action"></slot></div>
    </div>
  </BaseInput>
</template>
