<script setup lang="ts">
import { ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogScrollContent, DialogTitle, DialogTrigger, DialogClose } from './Dialog'
import Icon from './Icon.vue'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

const open = defineModel<boolean>({ default: false })
const emit = defineEmits(['close', 'open'])

function setOpen(value: boolean) {
  open.value = value
}

watch(open, () => {
  emit(open.value ? 'open' : 'close', true)
})
</script>

<template>
  <slot v-if="disabled" name="trigger" v-bind="{ setOpen, disabled }" />
  <Dialog v-else v-model:open="open">
    <DialogTrigger asChild v-slot="triggerBindings">
      <slot name="trigger" v-bind="{ setOpen, disabled, ...triggerBindings }" />
    </DialogTrigger>
    <DialogContent class="flex max-h-[95vh] flex-col" :class="$attrs.class">
      <DialogHeader v-if="$slots['title'] || $slots['description']" class="sticky top-0 z-10 border-b-[1px] border-outline-variant bg-surface-container px-6 pb-6 pt-6">
        <DialogClose
          class="focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
        >
          <Icon name="close"></Icon>
          <span class="sr-only">Close</span>
        </DialogClose>
        <DialogTitle v-if="$slots['title']">
          <slot name="title" v-bind="{ setOpen }" />
        </DialogTitle>
        <DialogDescription v-if="$slots['description']">
          <slot name="description" v-bind="{ setOpen }" />
        </DialogDescription>
      </DialogHeader>
      <div v-if="$slots['content']" class="flex flex-col gap-4 overflow-auto p-6">
        <slot name="content" v-bind="{ setOpen }" />
      </div>
      <DialogFooter v-if="$slots['footer']" class="mt-4 px-6 pb-6">
        <slot name="footer" v-bind="{ setOpen }" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
