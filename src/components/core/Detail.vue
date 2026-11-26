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
import { useFrameworkUiDefaults } from '../views/uiDefaults'

const props = withDefaults(defineProps<DetailProps<TRecord, TContext>>(), {
  searchParameters: () => ({}),
})

const instance = getCurrentInstance()
assertSingleDataSource('Detail', props.data, props.load, 'record', instance?.vnode.props ?? {})
onBeforeUpdate(() => assertSingleDataSource('Detail', props.data, props.load, 'record', instance?.vnode.props ?? {}))

const renderers = useRendererRegistry('display')
const uiDefaults = useFrameworkUiDefaults()
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

const sectionedEntries = computed(() => {
  const all = entries.value
  if (!props.sections || props.sections.length === 0) {
    return all.length > 0 ? [{ key: 'default', title: undefined as string | undefined, description: undefined as string | undefined, entries: all }] : []
  }
  const byKey = new Map(all.map((entry) => [entry.field.key, entry]))
  const used = new Set<string>()
  const groups: Array<{ key: string; title?: string; description?: string; entries: typeof all }> = []
  for (const [index, section] of props.sections.entries()) {
    const groupEntries: typeof all = []
    for (const fieldKey of section.fields) {
      const matched = byKey.get(fieldKey)
      if (matched && !used.has(fieldKey)) {
        used.add(fieldKey)
        groupEntries.push(matched)
      }
    }
    if (groupEntries.length > 0) {
      groups.push({ key: `section-${index}`, title: section.title, description: section.description, entries: groupEntries })
    }
  }
  const remaining = all.filter((entry) => !used.has(entry.field.key))
  if (remaining.length > 0) {
    groups.push({ key: 'section-remaining', entries: remaining })
  }
  return groups
})

defineExpose({ refresh: recordReader.refresh })
</script>

<template>
  <div class="is-detail">
    <slot v-if="recordReader.loading.value && !record" name="loading">
      <p role="status" aria-live="polite">{{ uiDefaults.loadingLabel }}</p>
    </slot>

    <slot v-else-if="recordReader.error.value && !record" name="error" :error="recordReader.error.value">
      <p role="alert">{{ recordReader.error.value?.message }}</p>
    </slot>

    <slot v-else-if="!record" name="empty">
      <p>{{ uiDefaults.notFoundLabel }}</p>
    </slot>

    <div v-else class="overflow-x-auto">
      <slot v-if="recordReader.error.value" name="read-error" :error="recordReader.error.value" :refresh="recordReader.refresh">
        <p role="alert">{{ recordReader.error.value.message }}</p>
      </slot>
      <table class="w-full border-collapse">
        <tbody>
          <template v-for="(group, groupIndex) in sectionedEntries" :key="group.key">
            <tr v-if="groupIndex > 0 && group.title" aria-hidden="true" class="is-detail-section-spacer">
              <td colspan="3" class="h-3 p-0" />
            </tr>
            <tr v-if="group.title" class="is-detail-section">
              <th
                colspan="3"
                scope="colgroup"
                class="text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                :class="groupIndex === 0 ? 'pb-2 pt-0.5' : 'border-t border-outline-variant pb-2 pt-4'"
              >
                <div>{{ group.title }}</div>
                <p v-if="group.description" class="mt-0.5 text-xs font-normal normal-case tracking-normal text-on-surface-variant">{{ group.description }}</p>
              </th>
            </tr>
            <tr v-for="entry in group.entries" :key="entry.field.key">
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
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
