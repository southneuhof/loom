<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>">
import { computed } from 'vue'
import type { ResolvedDisplayField } from './resolveDisplay'
import { useRendererRegistry } from '../renderers/registry'

const props = defineProps<{
  value: unknown
  record: TRecord
  field: ResolvedDisplayField<TRecord>
  index?: number
}>()

const renderers = useRendererRegistry('display')
const renderer = computed(() => props.field.renderer ? renderers.require(props.field.renderer) : undefined)
</script>

<template>
  <component
    :is="renderer"
    v-if="renderer"
    v-bind="field.props"
    :value="value"
    :record="record"
    :field="field"
    :index="index"
  />
  <template v-else>{{ value ?? '-' }}</template>
</template>
