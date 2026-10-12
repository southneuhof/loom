<script setup lang="ts">
import { ref, useId, useAttrs } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { BaseInputControlBindings } from '../../contracts/formControlBindings'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  field: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    required: false,
    default: '',
  },
  label: {
    type: String,
    required: false,
    default: '',
  },
  helperMessage: {
    type: String,
    required: false,
    default: '',
  },
  id: {
    type: String,
    required: false,
    default: undefined,
  },
  ariaDescribedby: {
    type: String,
    required: false,
    default: undefined,
  },
  ariaInvalid: {
    type: [Boolean, String],
    required: false,
    default: undefined,
  },
  ariaRequired: {
    type: [Boolean, String],
    required: false,
    default: undefined,
  },
  disabled: Boolean,
  required: Boolean,
})
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
defineSlots<{
  default(props: { controlBindings: BaseInputControlBindings }): unknown
  label(): unknown
}>()

const containerRef = ref<HTMLElement | null>(null)
const attrs = useAttrs()
const inputId = useId()
const helperId = `${inputId}-helper`
const errorId = `${inputId}-error`

function wrapperAttributes(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== 'id' && key !== 'aria-describedby' && key !== 'aria-invalid' && key !== 'aria-required'),
  )
}

function controlBindings(): BaseInputControlBindings {
  const describedBy = typeof props.ariaDescribedby === 'string'
    ? props.ariaDescribedby.trim().split(/\s+/).filter(Boolean)
    : []
  const ids = [
    ...describedBy,
    props.helperMessage ? helperId : undefined,
    props.error ? errorId : undefined,
  ].filter((id): id is string => id !== undefined)
  const uniqueIds = [...new Set(ids)]

  return {
    id: props.id || `${inputId}-control`,
    disabled: props.disabled,
    required: props.required,
    'aria-describedby': uniqueIds.length > 0 ? uniqueIds.join(' ') : undefined,
    'aria-invalid': props.error ? 'true' : props.ariaInvalid as BaseInputControlBindings['aria-invalid'],
    'aria-required': props.required ? 'true' : props.ariaRequired as BaseInputControlBindings['aria-required'],
  }
}

function onFocusOut(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Node | null
  const container = containerRef.value
  if (container && relatedTarget && container.contains(relatedTarget)) return
  emit('validation:touch')
}
</script>

<template>
  <div v-bind="wrapperAttributes()" ref="containerRef" @focusout="onFocusOut" :class="`${twMerge(`flex flex-col gap-2`, $attrs.class as string)}`">
    <div v-if="props.label || $slots.label" class="text-sm font-medium">
      <label v-if="props.label" :for="controlBindings().id" class="text-sm font-medium">
        <template v-if="!$slots.label">
          {{ props.label }}
          <span v-if="required" class="text-error">*</span>
        </template>
        <slot v-else name="label"></slot>
      </label>
    </div>
    <slot :control-bindings="controlBindings()"></slot>
    <p v-if="props.helperMessage" :id="helperId" class="text-sm text-on-surface/[67%]">{{ props.helperMessage }}</p>
    <p v-if="props.error" :id="errorId" role="alert" class="text-sm leading-5 text-error">{{ props.error }}</p>
  </div>
</template>
