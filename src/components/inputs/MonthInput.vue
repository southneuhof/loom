<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { ref, watch } from 'vue'
import { lightFormat } from 'date-fns'
import { datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp } from './datepickerPopup'

const props = defineProps({
  locale: {
    type: String,
    default: 'id-ID',
  },
  inline: {
    type: Boolean,
    default: false,
  },
  defaultToCurrent: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
  },
  minDate: {
    type: String,
  },
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<string | null>()

const internalValue = ref()
const modelUpdated = ref(false)

if (props.defaultToCurrent) internalValue.value = { month: String(new Date().getMonth()), year: String(new Date().getFullYear()) }
else if (modelValue.value) internalValue.value = { month: Number(modelValue.value.split('-')[1]) - 1, year: modelValue.value.split('-')[0] }

watch(
  internalValue,
  () => {
    if (!internalValue.value) {
      if (modelValue.value != null) modelValue.value = null
      return
    }
    const formattedValue = lightFormat(new Date(internalValue.value.year, internalValue.value.month, 1), 'yyyy-MM-dd')
    if (modelValue.value !== formattedValue) modelValue.value = formattedValue
  },
  { immediate: props.defaultToCurrent }
)

watch(
  () => modelValue.value,
  (newValue) => {
    if (!newValue) {
      if (internalValue.value != null) internalValue.value = null
      return
    }
    const month = Number(newValue.split('-')[1]) - 1
    const year = newValue.split('-')[0]
    const currentMonth = internalValue.value?.month
    const currentYear = internalValue.value?.year
    if (Number(currentMonth) === month && String(currentYear) === String(year)) return
    internalValue.value = { month, year }
  },
  { immediate: true }
)

function displayFormatter(date: Date) {
  return date.toLocaleDateString(props.locale, { year: 'numeric', month: 'long' })
}

function markModelUpdated() {
  modelUpdated.value = true
}

function handleBlur() {
  const wasUpdated = modelUpdated.value
  modelUpdated.value = false
  if (!wasUpdated) emit('validation:touch')
}
</script>

<template>
  <BaseInput v-bind="props">
    <Datepicker
      v-model="internalValue"
      :min-date="props.minDate"
      :placeholder="props.placeholder"
      month-picker
      :inline="inline"
      :format="displayFormatter"
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :config="datepickerPopupConfig"
      :class="datepickerPopupClass"
      @focusout.stop
      @update:model-value="markModelUpdated"
      @blur="handleBlur"
    />
  </BaseInput>
</template>
