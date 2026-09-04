<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { twMerge } from 'tailwind-merge'
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

type CardVariant = 'filled' | 'elevated' | 'outlined'
type CardColorRole =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'info'
  | 'infoContainer'
  | 'warning'
  | 'warningContainer'
  | 'success'
  | 'successContainer'
  | 'error'
  | 'surface'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest'
  | 'primaryContainer'
  | 'secondaryContainer'
  | 'tertiaryContainer'
  | 'errorContainer'

const attrs = useAttrs()

const props = withDefaults(
  defineProps<{
    variant?: CardVariant
    color?: CardColorRole
    containerRole?: CardColorRole
    disabled?: boolean
  }>(),
  {
    variant: 'filled',
    color: 'surfaceContainer',
    disabled: false,
  }
)

const isInteractive = computed(() => Boolean(attrs.onClick))

const resolvedRole = computed(
  () => props.color ?? props.containerRole ?? 'surfaceContainer'
)

const backgroundClassMap: Record<CardColorRole, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  tertiary: 'bg-tertiary',
  info: 'bg-info',
  infoContainer: 'bg-info-container',
  warning: 'bg-warning',
  warningContainer: 'bg-warning-container',
  success: 'bg-success',
  successContainer: 'bg-success-container',
  error: 'bg-error',
  surface: 'bg-surface',
  surfaceContainerLowest: 'bg-surface-container-lowest',
  surfaceContainerLow: 'bg-surface-container-low',
  surfaceContainer: 'bg-surface-container',
  surfaceContainerHigh: 'bg-surface-container-high',
  surfaceContainerHighest: 'bg-surface-container-highest',
  primaryContainer: 'bg-primary-container',
  secondaryContainer: 'bg-secondary-container',
  tertiaryContainer: 'bg-tertiary-container',
  errorContainer: 'bg-error-container',
}

const foregroundClassMap: Record<CardColorRole, string> = {
  primary: 'text-on-primary',
  secondary: 'text-on-secondary',
  tertiary: 'text-on-tertiary',
  info: 'text-on-info',
  infoContainer: 'text-on-info-container',
  warning: 'text-on-warning',
  warningContainer: 'text-on-warning-container',
  success: 'text-on-success',
  successContainer: 'text-on-success-container',
  error: 'text-on-error',
  surface: 'text-on-surface',
  surfaceContainerLowest: 'text-on-surface',
  surfaceContainerLow: 'text-on-surface',
  surfaceContainer: 'text-on-surface',
  surfaceContainerHigh: 'text-on-surface',
  surfaceContainerHighest: 'text-on-surface',
  primaryContainer: 'text-on-primary-container',
  secondaryContainer: 'text-on-secondary-container',
  tertiaryContainer: 'text-on-tertiary-container',
  errorContainer: 'text-on-error-container',
}

const stateLayerClassMap: Record<CardColorRole, string> = {
  primary: 'after:bg-on-primary-hover focus-visible:after:bg-on-primary-active active:after:bg-on-primary-active',
  secondary: 'after:bg-on-secondary-hover focus-visible:after:bg-on-secondary-active active:after:bg-on-secondary-active',
  tertiary: 'after:bg-on-tertiary-hover focus-visible:after:bg-on-tertiary-active active:after:bg-on-tertiary-active',
  info: 'after:bg-on-info-hover focus-visible:after:bg-on-info-active active:after:bg-on-info-active',
  infoContainer: 'after:bg-on-info-container-hover focus-visible:after:bg-on-info-container-active active:after:bg-on-info-container-active',
  warning: 'after:bg-on-warning-hover focus-visible:after:bg-on-warning-active active:after:bg-on-warning-active',
  warningContainer: 'after:bg-on-warning-container-hover focus-visible:after:bg-on-warning-container-active active:after:bg-on-warning-container-active',
  success: 'after:bg-on-success-hover focus-visible:after:bg-on-success-active active:after:bg-on-success-active',
  successContainer: 'after:bg-on-success-container-hover focus-visible:after:bg-on-success-container-active active:after:bg-on-success-container-active',
  error: 'after:bg-on-error-hover focus-visible:after:bg-on-error-active active:after:bg-on-error-active',
  surface: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  surfaceContainerLowest: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  surfaceContainerLow: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  surfaceContainer: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  surfaceContainerHigh: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  surfaceContainerHighest: 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
  primaryContainer: 'after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active',
  secondaryContainer: 'after:bg-on-secondary-container-hover focus-visible:after:bg-on-secondary-container-active active:after:bg-on-secondary-container-active',
  tertiaryContainer: 'after:bg-on-tertiary-container-hover focus-visible:after:bg-on-tertiary-container-active active:after:bg-on-tertiary-container-active',
  errorContainer: 'after:bg-on-error-container-hover focus-visible:after:bg-on-error-container-active active:after:bg-on-error-container-active',
}

const variantClassMap: Record<CardVariant, string> = {
  filled: '',
  outlined: 'border border-outline-variant',
  elevated: '',
}

const variantStyle = computed<CSSProperties>(() => {
  if (props.variant !== 'elevated') return {}
  return {
    boxShadow: '0 1px 1px rgb(var(--md-sys-color-shadow) / 0.28)',
  }
})

const mergedClass = computed(() =>
  twMerge(
    'relative flex flex-col gap-4 overflow-hidden rounded-xl p-4',
    backgroundClassMap[resolvedRole.value],
    foregroundClassMap[resolvedRole.value],
    variantClassMap[props.variant],
    isInteractive.value && !props.disabled
      ? `overlay cursor-pointer select-none transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${stateLayerClassMap[resolvedRole.value]}`
      : '',
    props.disabled ? 'pointer-events-none' : '',
    attrs.class as string
  )
)

const mergedStyle = computed(() => [variantStyle.value, attrs.style])

const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, onClick: _onClick, ...rest } =
    attrs as Record<string, unknown>
  return rest
})

const invokeClick = (event: Event) => {
  const onClick = attrs.onClick
  if (!onClick) return
  if (Array.isArray(onClick)) {
    onClick.forEach((handler) => {
      if (typeof handler === 'function') handler(event)
    })
    return
  }
  if (typeof onClick === 'function') onClick(event)
}

const handleRootClick = (event: MouseEvent) => {
  if (props.disabled) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  invokeClick(event)
}

const handleRootKeydown = (event: KeyboardEvent) => {
  if (!isInteractive.value || props.disabled) return

  if (event.key === 'Enter') {
    invokeClick(event)
    return
  }

  if (event.key === ' ') {
    event.preventDefault()
    invokeClick(event)
  }
}
</script>

<template>
  <div
    v-bind="forwardedAttrs"
    :role="isInteractive ? 'button' : undefined"
    :tabindex="isInteractive ? 0 : undefined"
    :aria-disabled="disabled ? 'true' : undefined"
    :class="mergedClass"
    :style="mergedStyle"
    @click="handleRootClick"
    @keydown="handleRootKeydown"
  >
    <div v-if="$slots.header"><slot name="header"></slot></div>
    <slot></slot>
    <div v-if="$slots.footer"><slot name="footer"></slot></div>
    <div
      v-if="disabled"
      class="pointer-events-none absolute inset-0 bg-on-surface/[12%]"
    />
  </div>
</template>
