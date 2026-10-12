<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import type { BaseInputControlBindings } from '../../contracts/formControlBindings'

const props = defineProps({
  controlBindings: { type: Object as PropType<BaseInputControlBindings>, required: true },
  value: { type: String, default: '' },
  isMenuOpen: Boolean,
  inputMode: { type: String as PropType<'text' | 'none'>, default: 'none' },
  placeholder: { type: String, default: undefined },
  onInput: { type: Function as PropType<(event: Event) => void>, required: true },
  onBlur: { type: Function as PropType<() => void>, required: true },
  onFocus: { type: Function as PropType<() => void>, required: true },
  onKeypress: { type: Function as PropType<(event: KeyboardEvent) => void>, required: true },
  onPaste: { type: Function as PropType<(event: ClipboardEvent) => void>, required: true },
})

const focused = ref(false)
const inputClasses = computed(() => ({
  dp__pointer: props.inputMode === 'none' && !props.controlBindings.disabled,
  dp__disabled: props.controlBindings.disabled,
  dp__input_readonly: props.inputMode === 'none',
  dp__input: true,
  dp__input_icon_pad: true,
  dp__input_reg: props.inputMode === 'none',
  dp__input_focus: focused.value || props.isMenuOpen,
}))

function handleFocus(): void {
  focused.value = true
  props.onFocus()
}

function handleBlur(): void {
  focused.value = false
  props.onBlur()
}
</script>

<template>
  <input
    v-bind="{ ...controlBindings, 'data-test-id': 'dp-input' }"
    :value="value"
    :inputmode="inputMode"
    :placeholder="placeholder"
    :readonly="inputMode === 'none'"
    autocomplete="off"
    :class="inputClasses"
    @input="onInput"
    @blur="handleBlur"
    @focus="handleFocus"
    @keydown="onKeypress"
    @paste="onPaste"
  />
</template>
