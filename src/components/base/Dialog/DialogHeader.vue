<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { twMerge } from 'tailwind-merge'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div :class="twMerge('flex flex-col gap-y-1.5 rounded-t-xl border-b-0 text-center shadow-none sm:text-left', props.class as any)">
    <slot />
  </div>
</template>
