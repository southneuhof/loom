<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import DatepickerControlInput from './DatepickerControlInput.vue'
import DatepickerInputIcon from './DatepickerInputIcon.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { nextTick, onMounted, ref } from 'vue'
import { datepickerInputBindings, datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp, useDatepickerBlur } from './datepickerPopup'

const props = defineProps({
  placeholder: String,
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
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<Date | number>()
const { markModelUpdated, handleBlur } = useDatepickerBlur(() => emit('validation:touch'))
if (!modelValue.value && props.defaultToCurrent) {
  modelValue.value = new Date().getFullYear()
}

const datepickerRef = ref<HTMLElement | null>(null)

const displayFormatter = (date: Date) => {
  return date.toLocaleDateString(props.locale, { year: 'numeric' })
}

const scrollToCurrentYear = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      const datepickerEl = datepickerRef.value
      if (!datepickerEl) return

      const currentYear = new Date().getFullYear().toString()
      const yearCells = datepickerEl.querySelectorAll('.dp__overlay_cell')
      const currentYearCell = Array.from(yearCells).find((cell) => cell.textContent?.trim() === currentYear)

      currentYearCell?.scrollIntoView({ block: 'center' })
    })
  })
}

onMounted(() => {
  if (props.inline) {
    scrollToCurrentYear()
  }
})
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <div ref="datepickerRef">
      <Datepicker
        v-model="modelValue"
        :disabled="controlBindings.disabled"
        :required="controlBindings.required"
        :placeholder="props.placeholder"
        year-picker
        :inline="inline"
        :format="displayFormatter"
        :dark="useFrameworkUi().colorPreference().value === 'dark'"
        :teleport="teleport"
        :config="datepickerPopupConfig"
        :class="datepickerPopupClass"
        @open="scrollToCurrentYear"
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
    </div>
  </BaseInput>
</template>
