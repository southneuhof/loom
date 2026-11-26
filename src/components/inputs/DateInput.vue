<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import DatepickerControlInput from './DatepickerControlInput.vue'
import DatepickerInputIcon from './DatepickerInputIcon.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { useFrameworkUiDefaults } from '../views/uiDefaults'
import { commonProps } from './commonprops'
import { ref, watch, type PropType } from 'vue'
import { isValid, lightFormat, parse } from 'date-fns'
import { datepickerInputBindings, datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp, useDatepickerBlur } from './datepickerPopup'

const props = defineProps({
  placeholder: String,
  locale: {
    type: String,
    default: undefined,
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

const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const modelValue = defineModel<string | null | undefined>()
const internalValue = ref<Date | null>(null)
const { markModelUpdated, handleBlur } = useDatepickerBlur(() => emit('validation:touch'))
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

const uiDefaults = useFrameworkUiDefaults()

function displayFormatter(date: Date) {
  if (!(date instanceof Date) || !isValid(date)) return ''
  return date.toLocaleDateString(props.locale ?? uiDefaults.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: props.withTimePicker ? 'numeric' : undefined,
    minute: props.withTimePicker ? 'numeric' : undefined,
    second: props.withTimePicker ? 'numeric' : undefined,
  })
}

function parseTextInput(value: string): Date | null {
  const parsedDate = parse(value, dateFormat, new Date())
  return isValid(parsedDate) && lightFormat(parsedDate, dateFormat) === value ? parsedDate : null
}

function handleTextInput(input: string | Event) {
  const value = typeof input === 'string' ? input : (input.target as HTMLInputElement | null)?.value
  if (value === undefined) return
  emit('validation:error', value === '' || parseTextInput(value) ? undefined : 'Enter a valid date.')
}

function markInvalidDate() {
  emit('validation:error', 'Enter a valid date.')
}

function handleModelUpdate() {
  markModelUpdated()
  emit('validation:error', undefined)
}
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <Datepicker
      :class="datepickerPopupClass"
      v-model="internalValue"
      :disabled="controlBindings.disabled"
      :required="controlBindings.required"
      :placeholder="props.placeholder"
      :minDate="minDate"
      auto-apply
      :inline="inline"
      :format="displayFormatter"
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :prevent-min-max-navigation="true"
      :enable-time-picker="withTimePicker"
      :config="datepickerPopupConfig"
      :text-input="{ format: parseTextInput }"
      @focusout.stop
      @update:model-value="handleModelUpdate"
      @invalid-date="markInvalidDate"
      @text-input="handleTextInput"
      @blur="handleBlur"
    >
      <template #dp-input="picker">
        <DatepickerControlInput
          :control-bindings="controlBindings"
          v-bind="datepickerInputBindings(picker)"
          input-mode="text"
          :placeholder="props.placeholder"
        />
      </template>
      <template #input-icon><DatepickerInputIcon /></template>
    </Datepicker>
  </BaseInput>
</template>
