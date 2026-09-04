<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'

const props = defineProps({
  onToggle: {
    type: Function,
    required: false,
    default: () => {},
  },
  onActive: {
    type: Function,
    required: false,
    default: () => {},
  },
  onDeactive: {
    type: Function,
    required: false,
    default: () => {},
  },
  description: {
    type: String,
    required: false,
    default: '',
  },
  checked: {
    type: Boolean,
    default: false,
  },
  static: {
    type: Boolean,
    default: false,
  },
  ...commonProps,
})

const modelValue = defineModel<any>()
if (['Y', 'N'].includes(modelValue.value)) modelValue.value = ({ Y: true, N: false } as any)[modelValue.value]
const inputValue = ref(modelValue.value)

if (props.static)
  watch(
    () => props.checked,
    () => {
      inputValue.value = props.checked
    },
    { immediate: true }
  )

function handleClick() {
  inputValue.value = !inputValue.value
  props.onToggle(inputValue.value)
  if (inputValue.value) props.onActive()
  else props.onDeactive()
  modelValue.value = inputValue.value
}

watch(
  () => modelValue.value,
  () => (inputValue.value = modelValue.value)
)
</script>

<template>
  <BaseInput v-bind="props" :label="''">
    <div @click="handleClick" class="group/checkbox flex cursor-default flex-row items-center gap-2">
      <input type="checkbox" class="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" :checked="inputValue || checked" @change="handleClick" @click.stop />
      <div v-if="label || description">{{ label || description }}</div>
    </div>
  </BaseInput>
</template>
