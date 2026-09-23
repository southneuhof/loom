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

const modelValue = defineModel<number>()
if (modelValue.value == null && props.defaultValue != null) modelValue.value = props.defaultValue
const editing = ref(false)
const numberValue = ref('')

function checkInput(e: InputEvent) {
  if (e.inputType !== 'insertText') return
  e.data && !/^[0-9\.\-]*$/.test(e.data) ? e.preventDefault() : null
}

function deformat(value: string) {
  if (value[0] === '0') value = value.slice(1)
  if (value[0] == '-' && value.length == 1) value = '-0'
  return value.replace(/[^0-9\-\.]/g, '')
}

function emitChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  numberValue.value = value
  const number = Number(deformat(value))
  if (Number.isFinite(number)) modelValue.value = number
}

function formatValue() {
  numberValue.value = modelValue.value == null || Number.isNaN(modelValue.value)
    ? ''
    : new Intl.NumberFormat(props.locale).format(modelValue.value)
}

watch(modelValue, () => {
  if (!editing.value) formatValue()
}, { immediate: true })

function focus() {
  editing.value = true
  numberValue.value = modelValue.value == null ? '' : String(modelValue.value)
}

function blur() {
  editing.value = false
  formatValue()
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
