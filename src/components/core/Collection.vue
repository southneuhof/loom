<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, getCurrentInstance, onBeforeUpdate } from 'vue'
import type { CollectionProps, CollectionSlotProps, QueryValues } from '../../contracts'
import { assertSingleDataSource } from './useCoreData'
import { useCollection } from './useCollection'

const props = withDefaults(defineProps<CollectionProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'always',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
}>()

const instance = getCurrentInstance()
assertSingleDataSource('Collection', props.data, props.load, 'collection', instance?.vnode.props ?? {})
onBeforeUpdate(() => assertSingleDataSource('Collection', props.data, props.load, 'collection', instance?.vnode.props ?? {}))

const collection = useCollection(() => props, {
  onUpdateQuery: (value) => emit('update:query', value),
  queryControlled: hasQueryProp,
})

const slotProps = computed<CollectionSlotProps<TRecord, TQuery>>(() => ({
  records: collection.records.value,
  meta: collection.meta.value,
  context: collection.context.value,
  loading: collection.loading.value,
  error: collection.error.value,
  empty: collection.empty.value,
  query: collection.query.value,
  refresh: collection.refresh,
  updateQuery: collection.updateQuery,
}))

defineExpose({
  refresh: collection.refresh,
  query: collection.query,
  updateQuery: collection.updateQuery,
  replaceQuery: collection.replaceQuery,
  resetQuery: collection.resetQuery,
  readReady: computed(() => !collection.loading.value && !collection.error.value),
})

function hasQueryProp(): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  return Object.hasOwn(vnodeProps, 'query') || Object.hasOwn(vnodeProps, 'query-value')
}
</script>

<template>
  <slot v-bind="slotProps" />
</template>
