<script setup lang="ts">
import { computed, ref, useAttrs, useSlots } from 'vue'
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { twMerge } from 'tailwind-merge'

defineOptions({
  inheritAttrs: false,
})

type ButtonKind = 'button' | 'icon' | 'split'

type ButtonVariant = 'elevated' | 'filled' | 'tonal' | 'outlined' | 'text' | 'standard'

type ButtonColor = 'primary' | 'info' | 'success' | 'warning' | 'error'

type ButtonType = 'submit' | 'button' | 'reset'

const props = withDefaults(
  defineProps<{
    kind?: ButtonKind
    variant?: ButtonVariant
    color?: ButtonColor

    disabled?: boolean
    softDisabled?: boolean

    href?: string
    target?: string
    type?: ButtonType
    name?: string
    value?: string
    form?: string

    trailingIcon?: boolean
    toggle?: boolean
    selected?: boolean
    ariaLabel?: string
    ariaLabelSelected?: string

    menuAriaLabel?: string
  }>(),
  {
    kind: 'button',
    variant: 'filled',
    color: 'primary',
    disabled: false,
    softDisabled: false,
    type: 'submit',
    trailingIcon: false,
    toggle: false,
    selected: false,
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
  'update:selected': [selected: boolean]
  input: [event: InputEvent]
  change: [event: Event]
  'trailing-click': [event: MouseEvent]
}>()

const attrs = useAttrs()
const slots = useSlots()
const menuOpen = ref(false)

const isIcon = computed(() => props.kind === 'icon')
const isSplit = computed(() => props.kind === 'split')
const isLink = computed(() => !!props.href)
const isDisabled = computed(() => props.disabled || props.softDisabled)
const currentAriaLabel = computed(() => (props.toggle && props.selected && props.ariaLabelSelected ? props.ariaLabelSelected : props.ariaLabel))

const resolvedVariant = computed<ButtonVariant>(() => {
  if (props.kind === 'button' && props.variant === 'standard') return 'text'
  if (props.kind === 'icon' && props.variant === 'text') return 'standard'
  if (props.kind === 'split' && (props.variant === 'text' || props.variant === 'standard')) return 'filled'

  return props.variant
})

const rootAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const hasLeadingIcon = computed(() => !!slots.icon)
const hasSelectedIcon = computed(() => !!slots['selected-icon'])
const hasTrailingIcon = computed(() => props.trailingIcon || !!slots['trailing-icon'])
const hasMenu = computed(() => !!slots.menu)

const baseInteractiveClass =
  'overlay relative inline-flex select-none items-center justify-center overflow-hidden whitespace-nowrap rounded-full border border-transparent align-middle transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:cursor-default'

const labelButtonClass =
  'h-10 min-w-16 gap-2 px-6 text-sm font-medium leading-5 tracking-normal disabled:bg-on-surface/[12%] disabled:text-on-surface/[38%] aria-disabled:pointer-events-auto aria-disabled:cursor-default aria-disabled:bg-on-surface/[12%] aria-disabled:text-on-surface/[38%]'

const iconButtonClass =
  'h-10 w-10 min-w-10 shrink-0 rounded-full p-2 text-[24px] leading-none disabled:bg-transparent disabled:text-on-surface/[38%] aria-disabled:pointer-events-auto aria-disabled:cursor-default aria-disabled:bg-transparent aria-disabled:text-on-surface/[38%]'

const variantClasses: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    filled: 'bg-primary text-on-primary shadow-none focus-visible:outline-primary after:bg-on-primary-hover focus-visible:after:bg-on-primary-active active:after:bg-on-primary-active',
    tonal: 'bg-secondary-container text-on-secondary-container shadow-none focus-visible:outline-secondary after:bg-on-secondary-container-hover focus-visible:after:bg-on-secondary-container-active active:after:bg-on-secondary-container-active',
    elevated: 'bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2 focus-visible:outline-primary after:bg-primary-hover focus-visible:after:bg-primary-active active:after:bg-primary-active',
    outlined: 'border-outline bg-transparent text-primary focus-visible:outline-primary after:bg-primary-hover focus-visible:after:bg-primary-active active:after:bg-primary-active disabled:border-on-surface/[12%] aria-disabled:border-on-surface/[12%]',
    text: 'bg-transparent text-primary focus-visible:outline-primary after:bg-primary-hover focus-visible:after:bg-primary-active active:after:bg-primary-active',
    standard: 'bg-transparent text-on-surface-variant focus-visible:outline-primary after:bg-on-surface-variant-hover focus-visible:after:bg-on-surface-variant-active active:after:bg-on-surface-variant-active',
  },
  info: {
    filled: 'bg-info text-on-info shadow-none focus-visible:outline-info after:bg-on-info-hover focus-visible:after:bg-on-info-active active:after:bg-on-info-active',
    tonal: 'bg-info-container text-on-info-container shadow-none focus-visible:outline-info after:bg-on-info-container-hover focus-visible:after:bg-on-info-container-active active:after:bg-on-info-container-active',
    elevated: 'bg-surface-container-low text-info shadow-elevation-1 hover:shadow-elevation-2 focus-visible:outline-info after:bg-info-hover focus-visible:after:bg-info-active active:after:bg-info-active',
    outlined: 'border-outline bg-transparent text-info focus-visible:outline-info after:bg-info-hover focus-visible:after:bg-info-active active:after:bg-info-active disabled:border-on-surface/[12%] aria-disabled:border-on-surface/[12%]',
    text: 'bg-transparent text-info focus-visible:outline-info after:bg-info-hover focus-visible:after:bg-info-active active:after:bg-info-active',
    standard: 'bg-transparent text-info focus-visible:outline-info after:bg-info-hover focus-visible:after:bg-info-active active:after:bg-info-active',
  },
  success: {
    filled: 'bg-success text-on-success shadow-none focus-visible:outline-success after:bg-on-success-hover focus-visible:after:bg-on-success-active active:after:bg-on-success-active',
    tonal: 'bg-success-container text-on-success-container shadow-none focus-visible:outline-success after:bg-on-success-container-hover focus-visible:after:bg-on-success-container-active active:after:bg-on-success-container-active',
    elevated: 'bg-surface-container-low text-success shadow-elevation-1 hover:shadow-elevation-2 focus-visible:outline-success after:bg-success-hover focus-visible:after:bg-success-active active:after:bg-success-active',
    outlined: 'border-outline bg-transparent text-success focus-visible:outline-success after:bg-success-hover focus-visible:after:bg-success-active active:after:bg-success-active disabled:border-on-surface/[12%] aria-disabled:border-on-surface/[12%]',
    text: 'bg-transparent text-success focus-visible:outline-success after:bg-success-hover focus-visible:after:bg-success-active active:after:bg-success-active',
    standard: 'bg-transparent text-success focus-visible:outline-success after:bg-success-hover focus-visible:after:bg-success-active active:after:bg-success-active',
  },
  warning: {
    filled: 'bg-warning text-on-warning shadow-none focus-visible:outline-warning after:bg-on-warning-hover focus-visible:after:bg-on-warning-active active:after:bg-on-warning-active',
    tonal: 'bg-warning-container text-on-warning-container shadow-none focus-visible:outline-warning after:bg-on-warning-container-hover focus-visible:after:bg-on-warning-container-active active:after:bg-on-warning-container-active',
    elevated: 'bg-surface-container-low text-warning shadow-elevation-1 hover:shadow-elevation-2 focus-visible:outline-warning after:bg-warning-hover focus-visible:after:bg-warning-active active:after:bg-warning-active',
    outlined: 'border-outline bg-transparent text-warning focus-visible:outline-warning after:bg-warning-hover focus-visible:after:bg-warning-active active:after:bg-warning-active disabled:border-on-surface/[12%] aria-disabled:border-on-surface/[12%]',
    text: 'bg-transparent text-warning focus-visible:outline-warning after:bg-warning-hover focus-visible:after:bg-warning-active active:after:bg-warning-active',
    standard: 'bg-transparent text-warning focus-visible:outline-warning after:bg-warning-hover focus-visible:after:bg-warning-active active:after:bg-warning-active',
  },
  error: {
    filled: 'bg-error text-on-error shadow-none focus-visible:outline-error after:bg-on-error-hover focus-visible:after:bg-on-error-active active:after:bg-on-error-active',
    tonal: 'bg-error-container text-on-error-container shadow-none focus-visible:outline-error after:bg-on-error-container-hover focus-visible:after:bg-on-error-container-active active:after:bg-on-error-container-active',
    elevated: 'bg-surface-container-low text-error shadow-elevation-1 hover:shadow-elevation-2 focus-visible:outline-error after:bg-error-hover focus-visible:after:bg-error-active active:after:bg-error-active',
    outlined: 'border-outline bg-transparent text-error focus-visible:outline-error after:bg-error-hover focus-visible:after:bg-error-active active:after:bg-error-active disabled:border-on-surface/[12%] aria-disabled:border-on-surface/[12%]',
    text: 'bg-transparent text-error focus-visible:outline-error after:bg-error-hover focus-visible:after:bg-error-active active:after:bg-error-active',
    standard: 'bg-transparent text-error focus-visible:outline-error after:bg-error-hover focus-visible:after:bg-error-active active:after:bg-error-active',
  },
}

const selectedStandardIconClass: Record<ButtonColor, string> = {
  primary: 'bg-primary text-on-primary after:bg-on-primary-hover focus-visible:after:bg-on-primary-active active:after:bg-on-primary-active',
  info: 'bg-info text-on-info after:bg-on-info-hover focus-visible:after:bg-on-info-active active:after:bg-on-info-active',
  success: 'bg-success text-on-success after:bg-on-success-hover focus-visible:after:bg-on-success-active active:after:bg-on-success-active',
  warning: 'bg-warning text-on-warning after:bg-on-warning-hover focus-visible:after:bg-on-warning-active active:after:bg-on-warning-active',
  error: 'bg-error text-on-error after:bg-on-error-hover focus-visible:after:bg-on-error-active active:after:bg-on-error-active',
}

const regularPaddingClass = computed(() => {
  if (hasLeadingIcon.value && hasTrailingIcon.value) return 'pl-4 pr-4'
  if (hasLeadingIcon.value) return 'pl-4 pr-6'
  if (hasTrailingIcon.value) return 'pl-6 pr-4'
  return ''
})

const regularClasses = computed(() =>
  twMerge(baseInteractiveClass, labelButtonClass, variantClasses[props.color][resolvedVariant.value], regularPaddingClass.value, attrs.class as string | undefined),
)

const iconClasses = computed(() =>
  twMerge(
    baseInteractiveClass,
    iconButtonClass,
    variantClasses[props.color][resolvedVariant.value],
    props.selected && props.toggle && resolvedVariant.value === 'standard' ? selectedStandardIconClass[props.color] : '',
    attrs.class as string | undefined,
  ),
)

const splitPrimaryClasses = computed(() =>
  twMerge(
    baseInteractiveClass,
    labelButtonClass,
    variantClasses[props.color][resolvedVariant.value],
    'rounded-r-sm pl-5 pr-4 disabled:rounded-r-sm aria-disabled:rounded-r-sm',
    hasLeadingIcon.value ? 'pl-4' : '',
    attrs.class as string | undefined,
  ),
)

const splitTrailingClasses = computed(() =>
  twMerge(baseInteractiveClass, iconButtonClass, variantClasses[props.color][resolvedVariant.value], 'w-12 rounded-l-sm border-l-outline/[24%] px-3'),
)

if ((import.meta as any).env?.DEV) {
  if (props.kind === 'button' && props.variant === 'standard') {
    console.warn('[Button] kind="button" does not support variant="standard"; falling back to variant="text".')
  }

  if (props.kind === 'icon' && props.variant === 'text') {
    console.warn('[Button] kind="icon" does not support variant="text"; falling back to variant="standard".')
  }

  if (props.kind === 'split' && (props.variant === 'text' || props.variant === 'standard')) {
    console.warn('[Button] kind="split" does not support variant="text" or "standard"; falling back to variant="filled".')
  }

  if (props.kind === 'icon' && !currentAriaLabel.value) {
    console.warn('[Button] kind="icon" requires aria-label for accessible icon-only usage.')
  }
}

function dispatchToggleEvents(event: MouseEvent) {
  const selected = !props.selected

  emit('update:selected', selected)
  emit('input', new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
  emit('change', new Event('change', { bubbles: true }))

  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
    event.currentTarget.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function handleClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }

  if (props.toggle) dispatchToggleEvents(event)

  emit('click', event)
}

function handleTrailingClick(event: MouseEvent) {
  if (isDisabled.value) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }

  emit('trailing-click', event)
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <span v-if="isSplit" v-bind="rootAttrs" role="group" class="inline-flex h-10 items-center gap-px align-middle">
    <component
      :is="isLink ? 'a' : 'button'"
      :href="isLink && !isDisabled ? href : undefined"
      :target="isLink ? target : undefined"
      :type="isLink ? undefined : type"
      :name="isLink ? undefined : name"
      :value="isLink ? undefined : value"
      :form="isLink ? undefined : form"
      :disabled="!isLink && disabled ? true : undefined"
      :aria-disabled="softDisabled || (isLink && disabled) ? 'true' : undefined"
      :tabindex="softDisabled ? 0 : undefined"
      :class="splitPrimaryClasses"
      @click="handleClick"
    >
      <span v-if="hasLeadingIcon" class="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>*]:h-[18px] [&>*]:w-[18px]">
        <slot name="icon" />
      </span>
      <span class="inline-flex items-center">
        <slot />
      </span>
    </component>

    <DropdownMenuRoot v-if="hasMenu" v-model:open="menuOpen">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :disabled="disabled ? true : undefined"
          :aria-disabled="softDisabled ? 'true' : undefined"
          :tabindex="softDisabled ? 0 : undefined"
          :aria-label="menuAriaLabel"
          aria-haspopup="menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          :class="splitTrailingClasses"
          @click="handleTrailingClick"
        >
          <span class="inline-flex h-6 w-6 items-center justify-center [&>*]:h-6 [&>*]:w-6">
            <slot v-if="$slots['trailing-icon']" name="trailing-icon" />
            <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="h-6 w-6 fill-current">
              <path d="M7 10l5 5 5-5H7z" />
            </svg>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="4"
          class="z-[20] min-w-40 rounded-lg border border-outline/[12%] bg-surface-container p-1 text-on-surface shadow-elevation-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <slot name="menu" v-bind="{ open: menuOpen, close: closeMenu }" />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <button
      v-else
      type="button"
      :disabled="disabled ? true : undefined"
      :aria-disabled="softDisabled ? 'true' : undefined"
      :tabindex="softDisabled ? 0 : undefined"
      :aria-label="menuAriaLabel"
      aria-haspopup="menu"
      :aria-expanded="undefined"
      :class="splitTrailingClasses"
      @click="handleTrailingClick"
    >
      <span class="inline-flex h-6 w-6 items-center justify-center [&>*]:h-6 [&>*]:w-6">
        <slot v-if="$slots['trailing-icon']" name="trailing-icon" />
        <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="h-6 w-6 fill-current">
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </span>
    </button>
  </span>

  <component
    :is="isLink ? 'a' : 'button'"
    v-else
    v-bind="rootAttrs"
    :href="isLink && !isDisabled ? href : undefined"
    :target="isLink ? target : undefined"
    :type="isLink ? undefined : type"
    :name="isLink ? undefined : name"
    :value="isLink ? undefined : value"
    :form="isLink ? undefined : form"
    :disabled="!isLink && disabled ? true : undefined"
    :aria-disabled="softDisabled || (isLink && disabled) ? 'true' : undefined"
    :tabindex="softDisabled ? 0 : undefined"
    :aria-label="isIcon ? currentAriaLabel : undefined"
    :aria-pressed="isIcon && toggle ? String(selected) : undefined"
    :class="isIcon ? iconClasses : regularClasses"
    @click="handleClick"
  >
    <template v-if="isIcon">
      <span class="inline-flex h-6 w-6 items-center justify-center [&>*]:h-6 [&>*]:w-6">
        <slot v-if="toggle && selected && hasSelectedIcon" name="selected-icon" />
        <slot v-else name="icon" />
      </span>
    </template>
    <template v-else>
      <span v-if="hasLeadingIcon && !trailingIcon" class="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>*]:h-[18px] [&>*]:w-[18px]">
        <slot name="icon" />
      </span>
      <span class="inline-flex items-center">
        <slot />
      </span>
      <span v-if="hasTrailingIcon" class="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center [&>*]:h-[18px] [&>*]:w-[18px]">
        <slot v-if="$slots['trailing-icon']" name="trailing-icon" />
        <slot v-else name="icon" />
      </span>
    </template>
  </component>
</template>
