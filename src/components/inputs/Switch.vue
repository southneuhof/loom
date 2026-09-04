<script setup lang="ts">
import { computed, type PropType } from 'vue'

type SwitchSize = 'lg' | 'md'

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
})

const modelValue = defineModel<boolean>({ default: false })
const isChecked = computed(() => modelValue.value)

const classMap = {
  track: {
    inactive: 'bg-surface-container-highest outline outline-2 outline-outline/[24%] ',
    active: 'bg-primary ',
    disabled: 'bg-surface-container-highest outline outline-2 outline-outline/[12%] cursor-not-allowed ',
  },
  thumb: {
    inactive: 'bg-outline ',
    active: 'bg-on-primary ',
    disabled: 'bg-outline/[38%] ',
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
</script>

<template>
  <div class="flex flex-row items-center gap-4">
    <button
      type="button"
      @click="handleClick"
      :class="`rounded-full ${sizeMap[props.size].track} ${props.disabled ? classMap.track.disabled : isChecked ? classMap.track.active : classMap.track.inactive}`"
      :disabled="props.disabled"
    >
      <div class="flex h-full w-full">
        <div
          :class="`rounded-full transition-all ${sizeMap[props.size].thumb} ${props.disabled ? classMap.thumb.disabled : isChecked ? classMap.thumb.active : classMap.thumb.inactive} ${isChecked && !props.disabled ? sizeMap[props.size].thumbActive : ''}`"
        ></div>
      </div>
    </button>
    <div v-if="label || description">{{ label || description }}</div>
  </div>
</template>
