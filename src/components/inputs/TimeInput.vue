<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import DatepickerControlInput from './DatepickerControlInput.vue'
import DatepickerInputIcon from './DatepickerInputIcon.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { formatTimeValue, parseTimeValue, type TimeParts } from './timeInput.utils'
import { ref, watch } from 'vue'
import { datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp } from './datepickerPopup'

const props = defineProps({
  placeholder: String,
  locale: {
    type: String,
    default: 'id-ID',
  },
  defaultToCurrent: {
    type: Boolean,
    default: false,
  },
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<string>()
// if (props.defaultToCurrent && !modelValue.value) modelValue.value = {hours: String(new Date().getHours()), minutes: String(new Date().getMinutes()), seconds: String(new Date().getSeconds())}

const internalValue = ref<TimeParts | null>()

if (props.defaultToCurrent) internalValue.value = { hours: new Date().getHours(), minutes: new Date().getMinutes(), seconds: new Date().getSeconds() }
else if (modelValue.value) internalValue.value = parseTimeValue(modelValue.value)

watch(
  internalValue,
  () => {
    if (!internalValue.value) {
      if (modelValue.value != null) modelValue.value = ''
      return
    }
    modelValue.value = formatTimeValue(internalValue.value)
  },
  { immediate: props.defaultToCurrent, flush: 'sync' }
)

watch(
  () => modelValue.value,
  (newValue) => {
    if (!newValue) {
      if (internalValue.value != null) internalValue.value = null
      return
    }
    const { hours, minutes, seconds } = parseTimeValue(newValue)
    const currentHours = Number(internalValue.value?.hours)
    const currentMinutes = Number(internalValue.value?.minutes)
    const currentSeconds = Number(internalValue.value?.seconds)
    if (currentHours === hours && currentMinutes === minutes && currentSeconds === seconds) return
    internalValue.value = { hours, minutes, seconds }
  },
  { immediate: true }
)

function displayFormatter(value: Record<string, any>) {
  return modelValue.value ? modelValue.value : 'Masukkan Waktu'
}

function handleBlur() {
  emit('validation:touch')
}
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <Datepicker
      v-model="internalValue"
      :disabled="controlBindings.disabled"
      :required="controlBindings.required"
      :placeholder="props.placeholder"
      :format="displayFormatter"
      time-picker
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :config="datepickerPopupConfig"
      :class="datepickerPopupClass"
      @focusout.stop
      @blur="handleBlur"
    >
      <template #dp-input="{ value, isMenuOpen, onInput, onBlur, onFocus, onKeypress, onPaste }">
        <DatepickerControlInput
          :control-bindings="controlBindings"
          :value="value"
          :is-menu-open="isMenuOpen"
          input-mode="none"
          :placeholder="props.placeholder"
          :on-input="onInput"
          :on-blur="onBlur"
          :on-focus="onFocus"
          :on-keypress="onKeypress"
          :on-paste="onPaste"
        />
      </template>
      <template #input-icon><DatepickerInputIcon /></template>
    </Datepicker>
  </BaseInput>
</template>
