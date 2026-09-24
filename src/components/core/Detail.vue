<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>">
/**
 * Record core.
 *
 * Owns record loading, field rendering, and loading/empty/error states. It owns
 * no page layout, route navigation, or edit and delete controls.
 */
import { computed, useSlots } from 'vue'
import type { DetailProps, RecordLoadContext, RecordResult } from '../../contracts'
import DisplayValue from '../../display/DisplayValue.vue'
import { resolveDisplayFields, resolveDisplayValue } from '../../display/resolveDisplay'
import { useLoader } from '../../query'
import { schemaOutputKeys } from '../../schemas/compileSchema'
import { useRendererRegistry } from '../../renderers/registry'
import { assertSingleDataSource, instanceIdentity, recordCacheKey } from './useCoreData'

const props = withDefaults(defineProps<DetailProps<TRecord>>(), {
  searchParameters: () => ({}),
})

assertSingleDataSource('Detail', props.data, props.load, 'record')

const renderers = useRendererRegistry('display')
const slots = useSlots()
const fields = computed(() => {
  const resolved = resolveDisplayFields({
    surface: 'detail',
    entries: props.fields,
    labels: props.labels,
    recordKeys: schemaOutputKeys(props.schema),
  })
  for (const field of resolved) {
    if (field.renderer) renderers.require(field.renderer)
  }
  return resolved
})
const fallbackOwner = instanceIdentity('detail')
const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)

const loaded = useLoader<RecordLoadContext, RecordResult<TRecord>>({
  key: computed(() => recordCacheKey(owner.value, props.id, 'display', props.namespace, props.searchParameters ?? {})),
  context: computed(() => ({ id: props.id, searchParameters: props.searchParameters ?? {} })),
  load: computed(() => props.load),
  data: computed(() => props.data),
})

const record = computed(() => loaded.data.value)
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

defineExpose({ refresh: loaded.refresh })
</script>

<template>
  <div class="is-detail">
    <slot v-if="loaded.loading.value" name="loading">
      <p role="status" aria-live="polite">Memuat…</p>
    </slot>

    <slot v-else-if="loaded.error.value" name="error" :error="loaded.error.value">
      <p role="alert">{{ loaded.error.value?.message }}</p>
    </slot>

    <slot v-else-if="!record" name="empty">
      <p>Data tidak ditemukan.</p>
    </slot>

    <div v-else class="overflow-x-auto">
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
