<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import type { Component } from 'vue'

type MenuItem = {
  name: string
  icon?: Component
  action: () => void
}

const props = defineProps({
  items: {
    type: Array<MenuItem>,
    required: true,
  },
})
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <div class="inline-block">
        <slot name="trigger"></slot>
      </div>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        side="top"
        :side-offset="8"
        class="z-50 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg transition duration-100 ease-out data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100"
      >
        <div class="px-1 py-1">
          <DropdownMenuItem v-for="item in items" :key="item.name" as-child @select="item.action">
            <button class="overlay flex w-full items-center rounded-md px-2 py-2 text-sm text-on-surface after:bg-on-surface-hover data-[highlighted]:after:bg-on-surface-active data-[highlighted]:after:opacity-100">
              <component v-if="item.icon" :is="item.icon" class="mr-2 h-5 w-5 text-violet-400"></component>
              {{ item.name }}
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
