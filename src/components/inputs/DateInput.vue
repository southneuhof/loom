<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { ref, watch, type PropType } from 'vue'
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
  withTimePicker: {
    type: Boolean,
    default: false,
  },
  defaultToCurrent: {
    type: Boolean,
    default: false,
  },
  minDate: {
    type: Object as PropType<Date>,
  },
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<string | null | undefined>()
const internalValue = ref<Date | null>(null)
const modelUpdated = ref(false)
const dateFormat = props.withTimePicker ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd'

const parseModelValue = (value: string | null | undefined) => {
  if (!value) return null
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return null
  return parsedDate
}

if (props.defaultToCurrent && !modelValue.value) {
  modelValue.value = lightFormat(new Date(), dateFormat)
}

watch(
  () => modelValue.value,
  (newValue) => {
    const parsedDate = parseModelValue(newValue)
    const hasChanged = (parsedDate?.getTime() ?? null) !== (internalValue.value?.getTime() ?? null)
    if (hasChanged) internalValue.value = parsedDate
  },
  { immediate: true }
)

watch(
  internalValue,
  (newValue) => {
    if (!newValue) {
      if (modelValue.value != null) modelValue.value = null
      return
    }
    const formattedValue = lightFormat(newValue, dateFormat)
    if (modelValue.value !== formattedValue) modelValue.value = formattedValue
  },
  { immediate: props.defaultToCurrent }
)

function displayFormatter(date: Date) {
  return date.toLocaleDateString(props.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: props.withTimePicker ? 'numeric' : undefined,
    minute: props.withTimePicker ? 'numeric' : undefined,
    second: props.withTimePicker ? 'numeric' : undefined,
  })
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
      :class="datepickerPopupClass"
      v-model="internalValue"
      :minDate="minDate"
      auto-apply
      :inline="inline"
      :format="displayFormatter"
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :prevent-min-max-navigation="true"
      :enable-time-picker="withTimePicker"
      :config="datepickerPopupConfig"
      @focusout.stop
      @update:model-value="markModelUpdated"
      @blur="handleBlur"
    />
  </BaseInput>
</template>
