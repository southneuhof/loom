<script setup lang="ts">
import type { PropType } from 'vue'
import { ref, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'

const props = defineProps({
  constraint: {
    type: Array as PropType<Array<'number' | 'text'>>,
    default: ['text', 'number'],
  },
  placeholder: {
    type: String,
    default: '',
  },
  rows: {
    type: Number,
    default: 3,
  },
  ...commonProps,
})

const modelValue = defineModel<string | number>()
const inputValue = ref<string | number | undefined>(modelValue.value)
const constraintRegex = {
  number: /^[0-9]*$/,
  text: /^[a-zA-Z\s]*$/,
}

function checkInput(e: InputEvent) {
  if (props.constraint.length !== 1 || e.inputType !== 'insertText') return
  e.data && !constraintRegex[props.constraint[0]].test(e.data) ? e.preventDefault() : null
}

watch(inputValue, (val) => {
  if (props.constraint[0] === 'number' && props.constraint.length === 1) modelValue.value = Number(inputValue.value)
  else modelValue.value = String(inputValue.value)
})

watch(
  () => modelValue.value,
  (newValue) => {
    if (inputValue.value !== newValue) inputValue.value = newValue
  },
  { immediate: true }
)
</script>

<template>
  <BaseInput v-bind="props">
    <div
      :class="`flex h-full flex-row items-center gap-4 rounded-lg bg-transparent pl-4 pt-3 outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus-within:outline-secondary focus-within:ring-1 focus-within:ring-secondary/30 ${
        error ? 'outline-error focus-within:outline-error focus-within:ring-error/30 ' : ''
      } ${disabled ? 'pointer-events-none cursor-not-allowed opacity-60 ' : ''}`"
    >
      <textarea class="h-full w-full bg-transparent focus-visible:outline-none" :rows="rows" :placeholder="placeholder" v-model="inputValue" @beforeinput="(e) => checkInput(e as InputEvent)" />
      <div v-if="$slots.action" class="mr-4 max-h-min"><slot name="action"></slot></div>
    </div>
  </BaseInput>
</template>
