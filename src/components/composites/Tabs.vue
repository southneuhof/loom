<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { computed, inject } from 'vue'
import { RouterLink, routeLocationKey, routerKey } from 'vue-router'
import { defaultAccessAdapter, frameworkAdaptersKey } from '../../adapters/projectAdapters'
import type { TabsItem, TabsProps } from './tabs'
export type { TabsItem, RoutedTabItem, TabsProps } from './tabs'

const props = defineProps<TabsProps>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const router = inject(routerKey, null)
const route = inject(routeLocationKey, null)
const access = inject(frameworkAdaptersKey, null)?.access ?? defaultAccessAdapter
const localItems = computed(() => props.items.filter((item): item is TabsItem => item.to === undefined))
const modelValue = computed({ get: () => props.modelValue ?? '', set: (value: string) => emit('update:modelValue', value) })
const routed = computed(() => props.modelValue === undefined)
const routes = computed(() => {
  if (!routed.value) return []
  if (!router || !route) throw new Error('[loom] Routed Tabs requires Vue Router.')
  return props.items.flatMap((item) => {
    if (item.to === undefined) return []
    if (item.permission && !access.allows({ operation: 'detail', permission: item.permission, record: props.record })) return []
    const target = router.resolve(item.to)
    const query = { ...Object.fromEntries(Object.entries(route.query).filter(([key]) => key.includes('.'))), ...target.query }
    return [{ ...item, target: { path: target.path, query, hash: target.hash } }]
  })
})
const activePath = computed(() =>
  routes.value.reduce<string | undefined>((active, item) => {
    const path = item.target.path
    const matches = route?.path === path || route?.path.startsWith(`${path.replace(/\/$/, '')}/`)
    return matches && (!active || path.length > active.length) ? path : active
  }, undefined)
)
const listClass = computed(() => ((props.variant ?? 'filled') === 'filled' ? 'rounded-xl border border-outline-variant bg-surface-container-low p-1.5' : 'rounded-lg bg-surface-container p-1'))
const triggerClass = computed(() =>
  (props.variant ?? 'filled') === 'filled'
    ? 'rounded-lg px-4 py-3 hover:bg-primary/10 hover:text-primary active:bg-primary/20 data-[state=active]:bg-primary data-[state=active]:text-on-primary data-[state=active]:hover:bg-primary/90 data-[state=active]:active:bg-primary/80'
    : 'rounded-md px-4 py-2 hover:bg-surface-container-high hover:text-on-surface data-[state=active]:bg-surface data-[state=active]:text-on-surface data-[state=active]:shadow-sm'
)
const orientationClass = computed(() => (props.orientation === 'vertical' ? 'w-full flex-col items-stretch overflow-y-auto' : 'w-fit flex-row items-center overflow-x-auto'))
const itemClass = computed(() => [
  triggerClass.value,
  'text-sm font-medium text-on-surface-variant outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  props.orientation === 'vertical' ? 'w-full text-start' : 'min-w-max',
])
</script>

<template>
  <nav v-if="routed && routes.length" :aria-label="props.label" :class="[listClass, orientationClass]" class="flex max-w-full gap-1">
    <template v-for="item in routes" :key="item.target.path">
      <span v-if="item.disabled" :class="itemClass" aria-disabled="true">{{ item.label }}</span>
      <RouterLink
        v-else
        :to="item.target"
        :class="itemClass"
        v-bind="{ 'data-state': item.target.path === activePath ? 'active' : 'inactive', 'aria-current': item.target.path === activePath ? 'page' : undefined }"
      >
        {{ item.label }}
      </RouterLink>
    </template>
  </nav>
  <TabsRoot v-else-if="!routed" v-model="modelValue" :orientation="props.orientation ?? 'horizontal'">
    <TabsList v-bind="{ 'aria-label': props.label }" :class="[listClass, orientationClass]" class="flex max-w-full gap-1">
      <TabsTrigger v-for="item in localItems" :key="item.value" :value="item.value" :disabled="item.disabled" as-child>
        <button type="button" :disabled="item.disabled" :class="itemClass">{{ item.label }}</button>
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
