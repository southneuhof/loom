<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import { twMerge } from 'tailwind-merge'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  suffix: {
    type: String,
    default: '',
  },
  prefix: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  placeholder: {
    type: Number,
    default: '',
  },
  defaultValue: {
    type: Number,
  },
  locale: {
    type: String,
    required: false,
    default: 'en-US',
  },
  currency: {
    type: String,
    required: false,
    default: '',
  },
  ...commonProps,
})

const modelValue = defineModel<number | null | undefined>()
if (modelValue.value == null && props.defaultValue != null) modelValue.value = props.defaultValue
const emit = defineEmits<{
  (event: 'validation:error', message: string | undefined): void
  (event: 'validation:touch'): void
}>()
const editing = ref(false)
const numberValue = ref('')
const invalidValue = ref(false)

function checkInput(e: InputEvent) {
  if (e.inputType !== 'insertText') return
  e.data && !/^[0-9\.\-]*$/.test(e.data) ? e.preventDefault() : null
}

function parseNumber(value: string): number | undefined | null {
  if (value === '') return undefined
  const parts = new Intl.NumberFormat(props.locale).formatToParts(1234567890123)
  const group = parts.find((part) => part.type === 'group')?.value
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  const groups = parts.filter((part) => part.type === 'integer').map((part) => part.value)
  const primaryGroupSize = groups[groups.length - 1]?.length
  const secondaryGroupSize = groups[groups.length - 2]?.length ?? primaryGroupSize
  const groupPattern = group ? group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''
  const decimalPattern = decimal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const groupedInteger = group && primaryGroupSize && secondaryGroupSize
    ? `\\d{1,${secondaryGroupSize}}(?:${groupPattern}\\d{${secondaryGroupSize}})*${groupPattern}\\d{${primaryGroupSize}}`
    : '\\d+'
  const integerPattern = group ? `(?:\\d+|${groupedInteger})` : '\\d+'
  const localizedPattern = new RegExp(`^-?${integerPattern}(?:${decimalPattern}\\d*)?$`)
  const canonicalPattern = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/
  const localized = localizedPattern.test(value)
  if (!localized && !canonicalPattern.test(value)) return null
  const normalized = localized && group ? value.split(group).join('') : value
  const canonical = decimal === '.' || !localized ? normalized : normalized.replace(decimal, '.')
  const number = Number(canonical)
  return Number.isFinite(number) ? number : null
}

function emitChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  numberValue.value = value
  const number = parseNumber(value)
  if (number !== null) {
    modelValue.value = number
    invalidValue.value = false
    emit('validation:error', undefined)
  } else {
    invalidValue.value = true
    emit('validation:error', 'Enter a valid number.')
  }
}

function formatValue() {
  if (invalidValue.value) return
  numberValue.value = modelValue.value == null || Number.isNaN(modelValue.value)
    ? ''
    : new Intl.NumberFormat(props.locale).format(modelValue.value)
}

watch(modelValue, (value, previous) => {
  if (invalidValue.value && !Object.is(value, previous)) {
    invalidValue.value = false
    numberValue.value = value == null ? '' : String(value)
    emit('validation:error', undefined)
  }
  if (!editing.value) formatValue()
}, { immediate: true })

function focus() {
  editing.value = true
  if (!invalidValue.value) numberValue.value = modelValue.value == null ? '' : String(modelValue.value)
}

function blur() {
  editing.value = false
  if (!invalidValue.value) formatValue()
  emit('validation:touch')
}

const localizedPrefix = computed(() => {
  if (props.prefix) return props.prefix
  if (!props.currency) return ''

  return new Intl.NumberFormat(props.locale, {
    style: 'currency',
    currency: props.currency,
  })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? props.currency
})

</script>

<template>
  <BaseInput v-bind="props">
    <template #label v-if="$slots.label">
      <slot name="label"></slot>
    </template>
    <div
      :class="twMerge(`flex flex-row items-center gap-4 rounded-lg bg-transparent py-3 pl-4 outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus-within:outline-secondary focus-within:ring-1 focus-within:ring-secondary/30 ${error ? 'outline-error focus-within:outline-error focus-within:ring-error/30 ' : ''} ${disabled ? 'pointer-events-none cursor-not-allowed opacity-60 ' : ''}`, ($attrs.class as string))"
    >
      <Icon v-if="props.icon" :name="(props.icon as any)" />
      <p v-if="localizedPrefix">{{ localizedPrefix }}</p>
      <input
        :placeholder="String(placeholder)"
        :value="numberValue"
        class="w-full bg-transparent focus:outline-none"
        @beforeinput="(e) => checkInput(e as InputEvent)"
        @input="(event) => emitChange(event)"
        @focus="focus"
        @blur="blur"
      />
      <p v-if="props.suffix" class="mr-4">{{ suffix }}</p>
      <div v-if="$slots.action" class="mr-4 max-h-min"><slot name="action"></slot></div>
    </div>
  </BaseInput>
</template>
