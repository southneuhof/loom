<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import { commonProps } from './commonprops'
import { ref, type PropType, watch, computed } from 'vue'
import BaseInput from './BaseInput.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { lightFormat } from 'date-fns'
import { datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp } from './datepickerPopup'

const props = defineProps({
  locale: {
    type: String,
    default: 'id-ID',
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
const internalValue = ref()
const modelUpdated = ref(false)

if (modelValue.value) internalValue.value = [new Date(modelValue.value[0]), new Date(modelValue.value[1])]

watch(internalValue, () => {
  if (!internalValue.value || !internalValue.value[0] || !internalValue.value[1]) {
    modelValue.value = []
    return
  }
  modelValue.value = [lightFormat(internalValue.value[0], 'yyyy-MM-dd'), lightFormat(internalValue.value[1], 'yyyy-MM-dd')]
})

function displayFormatter(date: any) {
  if (props.unit === 'week') {
    console.log('type week', date)
    const firstDate = new Date(lightFormat(date, 'yyyy-MM-dd'))
    const secondDate = new Date(lightFormat(date, 'yyyy-MM-dd'))
    secondDate.setDate(date.getDate() + 6)
    return `${firstDate?.toLocaleDateString(props.locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${secondDate?.toLocaleDateString(props.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`
  } else if (date[0] && date[1]) {
    console.log('type arbitrary', date)
    const firstDate = new Date(lightFormat(date[0], 'yyyy-MM-dd'))
    const secondDate = new Date(lightFormat(date[1], 'yyyy-MM-dd'))
    return `${firstDate?.toLocaleDateString(props.locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - ${secondDate?.toLocaleDateString(props.locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`
  } else {
    return ''
  }
}

watch(
  () => modelValue.value,
  (newValue) => {
    if (!newValue || newValue.length < 2) {
      if (internalValue.value != null) internalValue.value = null
      return
    }
    const nextStart = new Date(newValue[0])
    const nextEnd = new Date(newValue[1])
    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) return
    const currentStart = internalValue.value?.[0]
    const currentEnd = internalValue.value?.[1]
    if (currentStart?.getTime?.() === nextStart.getTime() && currentEnd?.getTime?.() === nextEnd.getTime()) return
    internalValue.value = [nextStart, nextEnd]
  },
  { immediate: true, deep: true }
)

const testRef = ref()

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
      :range="unit === 'arbitrary'"
      :week-picker="unit === 'week'"
      :inline="inline"
      v-model="internalValue"
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
