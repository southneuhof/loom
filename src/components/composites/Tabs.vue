<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import type { PropType } from 'vue'

export interface TabsItem {
  value: string
  label: string
  disabled?: boolean
}

const props = defineProps({
  items: {
    type: Array as PropType<readonly TabsItem[]>,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
})

const modelValue = defineModel<string>({ required: true })
</script>

<template>
  <TabsRoot v-model="modelValue">
    <TabsList
      :aria-label="props.label"
      class="flex max-w-full flex-row items-center gap-1 overflow-x-auto rounded-lg bg-surface-container p-1"
    >
      <TabsTrigger
        v-for="item in props.items"
        :key="item.value"
        :value="item.value"
        :disabled="item.disabled"
        as-child
      >
        <button
          type="button"
          :disabled="item.disabled"
          class="min-w-max rounded-md px-4 py-2 text-sm font-medium text-on-surface-variant outline-none transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary data-[state=active]:bg-surface data-[state=active]:text-on-surface data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50"
        >
          {{ item.label }}
        </button>
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
