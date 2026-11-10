<script setup lang="ts" generic="TSchema extends RawSchema<object, object>, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, useSlots } from 'vue'
import type { DetailViewControls, DetailViewProps, DetailViewReadyProps, RouteTarget, RawSchema, RawSchemaOutput } from '../../contracts'
import { useRecord } from '../core/useRecord'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import Button from '../base/Button.vue'
import Icon from '../base/Icon.vue'
import ExportPreview from '../../exports/ExportPreview.vue'
import { defaultExportStyles } from '../../exports/defaultStyles'
import { useExport } from '../../exports/useExport'
import { resolveExportFields } from '../../exports/resolveExportFields'
import { inheritExportConfiguration } from '../../exports/inheritConfiguration'
import { createExportSnapshot } from '../../exports/document'
import { composeSourceGuards } from '../../resources/sourceGuard'
import { stableValue } from '../../query'
import NavigationHeader from './NavigationHeader.vue'

type TRecord = RawSchemaOutput<TSchema>

const props = defineProps<DetailViewProps<TRecord, TContext> & { detail: { schema: TSchema } }>()
const detail = computed(() => props.detail)
const reader = useRecord<TRecord, TContext>(() => detail.value)
const exportConfiguration = computed(() => {
  const configuration = typeof props.export === 'object' ? props.export : {}
  return { ...configuration, orientation: configuration.orientation ?? 'portrait' as const, formats: configuration.formats ?? ['pdf'] as const, styles: configuration.styles ?? (configuration.component ? undefined : defaultExportStyles) }
})
const exportState = useExport({
  available: () => Boolean(props.export) && Boolean(reader.record.value) && (props.exportAccess?.(reader.record.value) ?? true) && !reader.loading.value && !reader.error.value,
  source: () => [props.detail, props.export, reader.record.value],
  configuration: exportConfiguration,
  async prepare(signal) {
    signal.throwIfAborted()
    let record = reader.record.value
    if (!record) throw new Error('[loom] Export record is not ready.')
    const configuration = inheritExportConfiguration(detail.value, exportConfiguration.value.detail)
    const sourceGuard = detail.value.sourceGuard
    const overrideGuard = exportConfiguration.value.detail?.sourceGuard
    const guard = sourceGuard && overrideGuard ? composeSourceGuards(sourceGuard, overrideGuard) : sourceGuard ?? overrideGuard
    const loadContext = { id: detail.value.id, searchParameters: { ...exportConfiguration.value.detail?.searchParameters, ...detail.value.searchParameters }, signal }
    const alternateLoad = exportConfiguration.value.detail?.load
    guard?.beforeLoad(loadContext)
    if (alternateLoad && alternateLoad !== detail.value.load) {
      if (!sourceGuard) throw new Error('[loom] An alternate export loader requires the effective sourceGuard.')
      record = await alternateLoad(loadContext)
      if (!record) throw new Error('[loom] Export record was not found.')
    }
    const alternateData = exportConfiguration.value.detail?.data
    if (alternateData !== undefined && alternateData !== reader.record.value) {
      if (!sourceGuard) throw new Error('[loom] Alternate export data requires the effective sourceGuard.')
      record = alternateData
    }
    guard?.record(record)
    if (detail.value.recordIdentity && detail.value.id !== undefined && JSON.stringify(stableValue(detail.value.recordIdentity(record))) !== JSON.stringify(stableValue(detail.value.id))) throw new Error('[loom] Export loader returned a different record identity.')
    if (!(props.exportAccess?.(record) ?? true)) throw new Error('[loom] Export record access is not allowed.')
    signal.throwIfAborted()
    const context = configuration.context ?? ({} as TContext)
    return createExportSnapshot({ kind: 'fields', title: exportConfiguration.value.title ?? props.title, rows: [record], context, config: configuration, fields: () => resolveExportFields({ entries: configuration.fields, labels: configuration.labels, context, record, surface: 'detail' }) })
  },
})
const exportControls = exportState.controls
const controls = computed<DetailViewControls<TRecord>>(() => ({
  record: reader.record.value,
  loading: reader.loading.value,
  error: reader.error.value,
  refresh: reader.refresh,
  exportControls: exportControls.value,
}))
const readyProps = computed<DetailViewReadyProps<TRecord, TContext> | undefined>(() => {
  const record = reader.record.value
  if (!record) return undefined
  const { load: _load, data: _data, ...configuration } = detail.value
  return { record, exportControls: exportControls.value, detail: { ...configuration, data: record } }
})
const defaultBackTo: RouteTarget = { name: 'dashboard' }
const backTo = computed(() => (props.backTo === false ? undefined : (props.backTo ?? defaultBackTo)))
const slots = useSlots()
const detailSlotNames = () => Object.keys(slots).filter((name) => name.startsWith('value:'))
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <slot name="header" v-bind="controls" :export-controls="exportControls">
    <NavigationHeader :title="title ?? ''" :back-to="backTo">
      <template v-if="$slots.controls || exportControls.available" #controls>
        <slot name="controls" v-bind="controls" />
        <slot v-if="exportControls.available" name="export-action" :export-controls="exportControls">
          <Button type="button" kind="icon" variant="standard" ariaLabel="Ekspor" :disabled="exportControls.disabled" @click="exportControls.printPdf">
            <template #icon><Icon name="download" size="base" /></template>
          </Button>
        </slot>
        <p v-if="exportControls.error" role="alert">{{ exportControls.error.message }}</p>
      </template>
    </NavigationHeader>
    </slot>

    <slot v-if="!reader.record.value && reader.loading.value" name="loading">
      <p role="status" aria-live="polite">Memuat…</p>
    </slot>
    <slot v-else-if="!reader.record.value && reader.error.value" name="error" :error="reader.error.value" :refresh="reader.refresh">
      <p role="alert">{{ reader.error.value.message }}</p>
    </slot>
    <slot v-else-if="!readyProps" name="empty">
      <p>Data tidak ditemukan.</p>
    </slot>
    <template v-else>
      <slot v-if="reader.error.value" name="read-error" :error="reader.error.value" :refresh="reader.refresh">
        <p role="alert">{{ reader.error.value.message }}</p>
      </slot>
      <slot v-if="$slots.body" name="body" v-bind="readyProps" />
      <Card v-else variant="outlined" color="surfaceContainer" class="p-0">
        <div class="p-3 sm:p-4">
          <Detail v-bind="readyProps.detail">
            <template v-for="name in detailSlotNames()" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
          </Detail>
        </div>
      </Card>
    </template>
  </section>
  <ExportPreview v-model="exportState.open.value" v-model:target="exportState.target.value" :snapshot="exportState.snapshot.value" :document-target="exportState.documentTarget.value" :configuration="exportState.configuration.value" :controls="exportControls" @error="exportState.reportError" />
</template>
