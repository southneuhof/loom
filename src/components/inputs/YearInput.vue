<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { nextTick, onMounted, ref } from 'vue'
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
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<Date | number>()
const modelUpdated = ref(false)
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
    <div ref="datepickerRef">
      <Datepicker
        v-model="modelValue"
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
      />
    </div>
  </BaseInput>
</template>
