<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import { commonProps } from './commonprops'
import { ref, type PropType, watch } from 'vue'
import BaseInput from './BaseInput.vue'
import DatepickerControlInput from './DatepickerControlInput.vue'
import DatepickerInputIcon from './DatepickerInputIcon.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { useFrameworkUiDefaults } from '../views/uiDefaults'
import { lightFormat } from 'date-fns'
import { datepickerInputBindings, datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp, useDatepickerBlur } from './datepickerPopup'

const props = defineProps({
  placeholder: String,
  locale: {
    type: String,
    default: undefined,
  },
  unit: {
    type: String as PropType<'arbitrary' | 'week'>,
    default: 'arbitrary',
  },
  inline: {
    type: Boolean,
    default: false,
  },
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const modelValue = defineModel<string[]>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
}>()
const uiDefaults = useFrameworkUiDefaults()
const internalValue = ref()
const { markModelUpdated, handleBlur } = useDatepickerBlur(() => emit('validation:touch'))

function parseLocalDate(value: string | Date | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

watch(internalValue, () => {
  if (!internalValue.value || !internalValue.value[0] || !internalValue.value[1]) {
    modelValue.value = []
    return
  }
  modelValue.value = [lightFormat(internalValue.value[0], 'yyyy-MM-dd'), lightFormat(internalValue.value[1], 'yyyy-MM-dd')]
})

function formatDate(date: Date): string {
  return date.toLocaleDateString(props.locale ?? uiDefaults.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function displayFormatter(date: any) {
  if (props.unit === 'week') {
    const start = parseLocalDate(Array.isArray(date) ? date[0] : date)
    if (!start) return ''
    const end = Array.isArray(date) && date[1] ? parseLocalDate(date[1]) : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    if (!end) return ''
    return `${formatDate(start)} - ${formatDate(end)}`
  }
  if (Array.isArray(date) && date[0] && date[1]) {
    const firstDate = parseLocalDate(date[0])
    const secondDate = parseLocalDate(date[1])
    if (!firstDate || !secondDate) return ''
    return `${formatDate(firstDate)} - ${formatDate(secondDate)}`
  }
  return ''
}

watch(
  () => modelValue.value,
  (newValue) => {
    if (!newValue || newValue.length < 2) {
      if (internalValue.value != null) internalValue.value = null
      return
    }
    const nextStart = parseLocalDate(newValue[0])
    const nextEnd = parseLocalDate(newValue[1])
    if (!nextStart || !nextEnd) return
    const currentStart = internalValue.value?.[0]
    const currentEnd = internalValue.value?.[1]
    if (currentStart?.getTime?.() === nextStart.getTime() && currentEnd?.getTime?.() === nextEnd.getTime()) return
    internalValue.value = [nextStart, nextEnd]
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <Datepicker
      :range="unit === 'arbitrary'"
      :week-picker="unit === 'week'"
      :inline="inline"
      v-model="internalValue"
      :disabled="controlBindings.disabled"
      :required="controlBindings.required"
      :placeholder="props.placeholder"
      :format="displayFormatter"
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :config="datepickerPopupConfig"
      :class="datepickerPopupClass"
      @focusout.stop
      @update:model-value="markModelUpdated"
      @blur="handleBlur"
    >
      <template #dp-input="picker">
        <DatepickerControlInput
          :control-bindings="controlBindings"
          v-bind="datepickerInputBindings(picker)"
          input-mode="none"
          :placeholder="props.placeholder"
        />
      </template>
      <template #input-icon><DatepickerInputIcon /></template>
    </Datepicker>
  </BaseInput>
</template>
