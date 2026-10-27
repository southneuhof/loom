<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>">
/**
 * Record core.
 *
 * Owns record loading, field rendering, and loading/empty/error states. It owns
 * no page layout, route navigation, or edit and delete controls.
 */
import { computed, getCurrentInstance, onBeforeUpdate, useSlots } from 'vue'
import type { DetailProps } from '../../contracts'
import DisplayValue from '../../display/DisplayValue.vue'
import { resolveDisplayFields, resolveDisplayValue } from '../../display/resolveDisplay'
import { schemaOutputKeys } from '../../schemas/schemaRuntime'
import { useRendererRegistry } from '../../renderers/registry'
import { useRecord } from './useRecord'
import { assertSingleDataSource } from './useCoreData'

const props = withDefaults(defineProps<DetailProps<TRecord, TContext>>(), {
  searchParameters: () => ({}),
})

const instance = getCurrentInstance()
assertSingleDataSource('Detail', props.data, props.load, 'record', instance?.vnode.props ?? {})
onBeforeUpdate(() => {
  const supplied = instance?.vnode.props ?? {}
  if ((Object.hasOwn(supplied, 'data') && props.data === undefined) || (Object.hasOwn(supplied, 'load') && props.load === undefined)) {
    assertSingleDataSource('Detail', props.data, props.load, 'record', supplied)
  }
})

const renderers = useRendererRegistry('display')
const slots = useSlots()
const recordReader = useRecord(() => props)
const record = recordReader.record
const fields = computed(() => {
  const currentRecord = record.value
  if (!currentRecord) return []
  const resolved = resolveDisplayFields({
    surface: 'detail',
    entries: props.fields,
    labels: props.labels,
    record: currentRecord,
    context: (props.context ?? {}) as TContext,
    recordKeys: schemaOutputKeys(props.schema),
  })
  for (const field of resolved) {
    if (field.renderer) renderers.require(field.renderer)
  }
  return resolved
})
const entries = computed(() => {
  const currentRecord = record.value
  return currentRecord
    ? fields.value.map((field) => ({
        field,
        value: resolveDisplayValue(currentRecord, field),
        hasSlot: Boolean(slots[`value:${field.key}`]),
      }))
    : []
})

defineExpose({ refresh: recordReader.refresh })
</script>

<template>
  <div class="is-detail">
    <slot v-if="recordReader.loading.value && !record" name="loading">
      <p role="status" aria-live="polite">Memuat…</p>
    </slot>

    <slot v-else-if="recordReader.error.value && !record" name="error" :error="recordReader.error.value">
      <p role="alert">{{ recordReader.error.value?.message }}</p>
    </slot>

    <slot v-else-if="!record" name="empty">
      <p>Data tidak ditemukan.</p>
    </slot>

    <div v-else class="overflow-x-auto">
      <slot v-if="recordReader.error.value" name="read-error" :error="recordReader.error.value" :refresh="recordReader.refresh">
        <p role="alert">{{ recordReader.error.value.message }}</p>
      </slot>
      <table class="w-full border-collapse">
        <tbody>
          <tr v-for="entry in entries" :key="entry.field.key">
            <th scope="row" class="w-px whitespace-nowrap py-1 pe-3 text-left align-center text-sm font-normal text-on-surface">
              {{ entry.field.label }}
            </th>
            <td aria-hidden="true" class="w-px whitespace-nowrap py-1 pe-3 align-top text-on-surface-variant">:</td>
            <td
              class="min-w-0 break-words py-1 text-sm"
              :class="{
                'font-semibold text-on-surface': entry.field.emphasis === 'strong',
                'text-on-surface-variant': entry.field.emphasis === 'muted',
                'text-on-surface': !entry.field.emphasis,
              }"
            >
              <slot v-if="entry.hasSlot" :name="`value:${entry.field.key}`" :value="entry.value" :record="record" :field="entry.field" />
              <DisplayValue v-else :value="entry.value" :record="record" :field="entry.field" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
