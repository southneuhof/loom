<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal, ContextMenuContent, ContextMenuItem } from 'reka-ui'
import Card from './Card.vue'

type ContextMenuAction = {
  name: string
  icon?: Component
  disabled?: boolean
  action: () => void
}

const props = withDefaults(defineProps<{
  items?: readonly ContextMenuAction[]
  disabled?: boolean
  openOnClick?: boolean
  contentClass?: string
}>(), {
  items: () => [],
  disabled: false,
  openOnClick: false,
})
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const open = ref(false)
const triggerAttributes = computed(() => ({ 'aria-haspopup': 'menu', 'aria-expanded': open.value }))

function updateOpen(value: boolean) {
  open.value = value
  emit('update:open', value)
}

function openAtTrigger(target: EventTarget | null) {
  if (props.disabled || !(target instanceof HTMLElement)) return
  const rectangle = target.getBoundingClientRect()
  target.focus()
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rectangle.left, clientY: rectangle.bottom }))
}

function handleClick(event: MouseEvent) {
  if (props.openOnClick) openAtTrigger(event.currentTarget)
}

function handleKeydown(event: KeyboardEvent) {
  const contextKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
  const activationKey = props.openOnClick && (event.key === 'Enter' || event.key === ' ')
  if (props.disabled || (!contextKey && !activationKey)) return
  event.preventDefault()
  openAtTrigger(event.currentTarget)
}
</script>

<template>
  <ContextMenuRoot @update:open="updateOpen">
    <ContextMenuTrigger as-child :disabled="props.disabled" v-bind="triggerAttributes" @click="handleClick" @keydown="handleKeydown">
      <slot name="trigger" v-bind="{ open, disabled: props.disabled }" />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent class="z-50 duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:!pointer-events-none data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
        <Card :class="props.contentClass" class="min-w-48 gap-1 p-1" variant="outlined">
          <slot name="content" v-bind="{ open, disabled: props.disabled }">
            <ContextMenuItem v-for="item in props.items" :key="item.name" as-child :disabled="props.disabled || item.disabled" @select="item.action">
              <button type="button" :disabled="props.disabled || item.disabled" class="overlay flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-on-surface outline-none after:bg-on-surface-hover data-[highlighted]:after:bg-on-surface-active data-[highlighted]:after:opacity-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                <component :is="item.icon" v-if="item.icon" class="h-4 w-4" />
                {{ item.name }}
              </button>
            </ContextMenuItem>
          </slot>
        </Card>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
