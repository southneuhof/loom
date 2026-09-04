<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import { twMerge } from 'tailwind-merge'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  prefix: {
    type: String,
    default: '',
  },
  suffix: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: '',
  },
  constraint: {
    type: Array as PropType<Array<'number' | 'integer' | 'integerString' | 'decimal' | 'text'>>,
    default: () => ['decimal', 'text'],
  },
  ...commonProps,
})

const modelValue = defineModel<string | number>()
const inputValue = ref(modelValue.value)
const constraintRegex = {
  number: /^[0-9\.]*$/,
  integer: /^[0-9]*$/,
  integerString: /^[0-9]*$/,
  decimal: /^[0-9\.]*$/,
  text: /^[a-zA-Z\s]*$/,
}

function checkInput(e: InputEvent) {
  if (props.constraint.length !== 1 || e.inputType !== 'insertText') return
  e.data && !constraintRegex[props.constraint[0]].test(e.data) ? e.preventDefault() : null
}

watch(inputValue, (val) => {
  if (['number', 'integer', 'decimal'].includes(props.constraint[0]) && props.constraint.length === 1) modelValue.value = Number(inputValue.value)
  else modelValue.value = inputValue.value
})

watch(modelValue, (val) => {
  inputValue.value = modelValue.value
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
      <p v-if="props.prefix">{{ prefix }}</p>
      <input
        :type="props.type"
        :placeholder="placeholder"
        class="w-full bg-transparent focus-visible:outline-none"
        v-model="inputValue"
        @beforeinput="(e) => checkInput(e as InputEvent)"
        :disabled="disabled"
      />
      <p v-if="props.suffix" class="mr-4 min-w-max">{{ suffix }}</p>
      <div v-if="$slots.action" class="mr-4 max-h-min"><slot name="action"></slot></div>
    </div>
  </BaseInput>
</template>
