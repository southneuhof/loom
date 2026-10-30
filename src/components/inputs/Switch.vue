<script setup lang="ts">
import { computed, useAttrs, type PropType } from 'vue'
import BaseInput from './BaseInput.vue'

type SwitchSize = 'lg' | 'md'
type SwitchVisualState = 'active' | 'inactive' | 'disabled' | 'disabledActive'

const props = defineProps({
  onToggle: {
    type: Function as PropType<(value: boolean) => void>,
    required: false,
    default: () => {},
  },
  onActive: {
    type: Function,
    required: false,
    default: () => {},
  },
  onDeactive: {
    type: Function,
    required: false,
    default: () => {},
  },
  label: {
    type: String,
  },
  description: {
    type: String,
    required: false,
    default: '',
  },
  size: {
    type: String as () => SwitchSize,
    required: false,
    default: 'lg',
    validator: (value: string) => ['lg', 'md'].includes(value),
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false,
  },
  field: { type: String, default: '' },
  helperMessage: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<boolean>({ default: false })
const isChecked = computed(() => modelValue.value)
const attrs = useAttrs()
const visualState = computed<SwitchVisualState>(() => {
  if (!props.disabled) return isChecked.value ? 'active' : 'inactive'
  return isChecked.value ? 'disabledActive' : 'disabled'
})

const classMap = {
  track: {
    inactive: 'bg-surface-container-highest outline outline-2 outline-outline/[24%] ',
    active: 'bg-primary ',
    disabled: 'bg-surface-container-highest outline outline-2 outline-outline/[12%] cursor-not-allowed ',
    disabledActive: 'bg-primary/[38%] outline outline-2 outline-outline/[12%] cursor-not-allowed ',
  },
  thumb: {
    inactive: 'bg-outline ',
    active: 'bg-on-primary ',
    disabled: 'bg-outline/[38%] ',
    disabledActive: 'bg-surface ',
  },
}

const sizeMap: Record<
  SwitchSize,
  {
    track: string
    thumb: string
    thumbActive: string
  }
> = {
  lg: {
    track: 'min-w-[52px] max-w-[52px] p-2',
    thumb: 'min-w-[16px] min-h-[16px]',
    thumbActive: 'translate-x-[22px]',
  },
  md: {
    track: 'min-w-[40px] max-w-[40px] p-1.5',
    thumb: 'min-w-[14px] min-h-[14px]',
    thumbActive: 'translate-x-[16px]',
  },
}

function handleClick() {
  if (props.disabled) return

  const nextValue = !isChecked.value
  modelValue.value = nextValue
  props.onToggle(nextValue)
  if (nextValue) {
    props.onActive()
  } else {
    props.onDeactive()
  }
}

function nativeAttributes(): Record<string, unknown> {
  const attributes = Object.fromEntries(Object.entries(attrs).filter(([key]) => (
    key !== 'class'
    && key !== 'style'
    && key !== 'id'
    && key !== 'aria-describedby'
    && key !== 'aria-invalid'
    && key !== 'aria-required'
  )))
  if (attributes['aria-label'] === undefined && attributes['aria-labelledby'] === undefined) {
    attributes['aria-label'] = props.label || props.description || undefined
  }
  return attributes
}
</script>

<template>
  <BaseInput
    :class="attrs.class as string"
    :style="attrs.style as string"
    :field="props.field"
    :label="''"
    :id="attrs.id as string | undefined"
    :ariaDescribedby="attrs['aria-describedby'] as string | undefined"
    :ariaInvalid="attrs['aria-invalid'] as string | boolean | undefined"
    :ariaRequired="attrs['aria-required'] as string | boolean | undefined"
    :helper-message="props.helperMessage"
    :error="props.error"
    :disabled="props.disabled"
    :required="props.required"
    v-slot="{ controlBindings }"
    @validation:touch="emit('validation:touch')"
  >
    <div class="flex flex-row items-center gap-4">
      <button
        v-bind="{ ...nativeAttributes(), ...controlBindings }"
        type="button"
        role="switch"
        :aria-checked="isChecked"
        @click="handleClick"
        :class="`rounded-full ${sizeMap[props.size].track} ${classMap.track[visualState]}`"
        :disabled="props.disabled"
      >
        <div class="flex h-full w-full">
          <div
            :class="`rounded-full transition-all ${sizeMap[props.size].thumb} ${classMap.thumb[visualState]} ${isChecked ? sizeMap[props.size].thumbActive : ''}`"
          ></div>
        </div>
      </button>
      <div v-if="label || description">{{ label || description }}</div>
    </div>
  </BaseInput>
</template>
