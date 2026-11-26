<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TContext extends object = {}">
import { computed } from 'vue'
import type { ResolvedDisplayField } from './resolveDisplay'
import { useRendererRegistry } from '../renderers/registry'

const props = defineProps<{
  value: unknown
  record: TRecord
  field: ResolvedDisplayField<TRecord, TContext>
  index?: number
}>()

const renderers = useRendererRegistry('display')
const renderer = computed(() => (props.field.renderer ? renderers.require(props.field.renderer) : undefined))
const isMultilineText = computed(() => !renderer.value && typeof props.value === 'string' && props.value.includes('\n'))
</script>

<template>
  <component :is="renderer" v-if="renderer" v-bind="field.props" :value="value" :record="record" :field="field" :index="index" />
  <span v-else-if="isMultilineText" class="whitespace-pre-line">{{ value }}</span>
  <template v-else>{{ value ?? '-' }}</template>
</template>
