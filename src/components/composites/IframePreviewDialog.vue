<script setup lang="ts">
import { ref } from 'vue'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../base/Dialog'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: 'Preview',
  },
})

const open = ref(false)

function setOpen(value: boolean) {
  open.value = value
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger asChild>
      <slot name="trigger" v-bind="{ setOpen }"></slot>
    </DialogTrigger>
    <DialogContent class="flex max-h-[95vh] flex-col p-0" :class="$attrs.class">
      <DialogHeader class="sticky top-0 z-10 border-b-[1px] border-outline-variant bg-surface-container px-6 pb-6 pt-6">
        <DialogClose
          class="focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
        >
          <Icon name="close"></Icon>
          <span class="sr-only">Close</span>
        </DialogClose>
        <DialogTitle>
          <slot name="title" v-bind="{ setOpen }">{{ title }}</slot>
        </DialogTitle>
      </DialogHeader>
      <div class="h-[80vh] w-full">
        <iframe :src="url" class="h-full w-full border-0" title="Preview"></iframe>
      </div>
    </DialogContent>
  </Dialog>
</template>
