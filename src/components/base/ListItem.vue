<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { twMerge } from 'tailwind-merge'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    selected?: boolean
    disabled?: boolean
    href?: string
    target?: string
  }>(),
  {
    selected: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const attrs = useAttrs()
const isLink = computed(() => Boolean(props.href))
const rootAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const itemClass = computed(() =>
  twMerge(
    'is-list-item overlay relative flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50',
    props.selected
      ? 'border-primary bg-primary-container text-on-primary-container after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active'
      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active',
    attrs.class as string | undefined,
  ),
)

function handleClick(event: MouseEvent): void {
  if (props.disabled) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  emit('click', event)
}
</script>

<template>
  <component
    :is="isLink ? 'a' : 'button'"
    v-bind="rootAttrs"
    :href="isLink && !disabled ? href : undefined"
    :target="isLink ? target : undefined"
    :type="isLink ? undefined : 'button'"
    :disabled="!isLink && disabled ? true : undefined"
    :aria-disabled="isLink && disabled ? 'true' : undefined"
    :aria-current="isLink && selected ? 'page' : undefined"
    :aria-pressed="!isLink ? String(selected) : undefined"
    :class="itemClass"
    @click="handleClick"
  >
    <span v-if="$slots.leading" class="shrink-0">
      <slot name="leading" />
    </span>
    <span class="min-w-0 flex-1">
      <slot />
    </span>
    <span v-if="$slots.trailing" class="shrink-0">
      <slot name="trailing" />
    </span>
  </component>
</template>
