<script setup lang="ts">
import type { PropType } from 'vue'
const props = defineProps({
  color: {
    type: String as PropType<'primary' | 'secondary' | 'tertiary' | 'warning' | 'error' | 'info' | 'success' | 'neutral' | null>,
    required: false,
    default: 'primary',
  },
  variant: {
    type: String as PropType<'fill' | 'tonal' | 'outline'>,
    required: false,
    default: 'fill',
  },
  interactive: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const baseClass = `flex h-fit min-w-max w-fit items-center justify-center rounded-lg px-2 py-1 text-center text-sm ${
  props.interactive ? 'overlay cursor-pointer after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active' : ''
}`

const colorMap = {
  primary: {
    fill: 'bg-primary  text-on-primary ',
    tonal: 'bg-primary-container text-on-primary-container  ',
    outline: 'outline outline-1 outline-primary/[24%] ',
  },
  secondary: {
    fill: 'bg-secondary  text-on-secondary ',
    tonal: 'bg-secondary-container text-on-secondary-container  ',
    outline: 'outline outline-1 outline-secondary/[24%] ',
  },
  tertiary: {
    fill: 'bg-tertiary  text-on-tertiary ',
    tonal: 'bg-tertiary-container text-on-tertiary-container  ',
    outline: 'outline outline-1 outline-tertiary/[24%] ',
  },
  success: {
    fill: 'bg-success  text-on-success ',
    tonal: 'bg-success-container text-on-success-container  ',
    outline: 'outline outline-1 outline-success/[24%] ',
  },
  error: {
    fill: 'bg-error  text-on-error ',
    tonal: 'bg-error-container text-on-error-container  ',
    outline: 'outline outline-1 outline-error/[24%] ',
  },
  warning: {
    fill: 'bg-warning  text-on-warning ',
    tonal: 'bg-warning-container text-on-warning-container  ',
    outline: 'outline outline-1 outline-warning/[24%] ',
  },
  info: {
    fill: 'bg-info  text-on-info ',
    tonal: 'bg-info-container text-on-info-container  ',
    outline: 'outline outline-1 outline-info/[24%] ',
  },
  neutral: {
    fill: 'bg-surface-variant text-on-surface-variant ',
    tonal: 'bg-surface-container-high  text-on-surface ',
    outline: 'outline outline-1 outline-outline/[24%] ',
  },
}
</script>

<template>
  <div v-if="props.color" :class="`${baseClass} ${colorMap[props.color][props.variant]}`">
    <slot></slot>
  </div>
  <div v-else class="box-border flex h-fit w-fit items-center justify-center rounded-lg bg-surface-container-highest px-2 py-1 text-center text-sm text-on-surface">
    <slot></slot>
  </div>
</template>
