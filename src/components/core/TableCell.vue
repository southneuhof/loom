<script setup lang="ts">
import { computed } from 'vue'
import { useTableComposition } from './tableComposition'

const props = defineProps<{ column: string; span?: never } | { column?: never; span: 'all' }>()
const layout = useTableComposition()
const column = computed(() => layout.value.columns.find((entry) => entry.key === props.column))
const visible = computed(() => props.span === 'all' || layout.value.visibleColumns.some((entry) => entry.key === props.column))
const colspan = computed(() => (props.span === 'all' ? layout.value.visibleColumns.length + Number(layout.value.prefix) + Number(layout.value.actions) : undefined))
</script>

<template>
  <td v-if="visible" :colspan="colspan" :style="{ textAlign: column?.align }" :class="column?.class" class="px-4 py-3.5 text-on-surface">
    <slot />
  </td>
</template>
