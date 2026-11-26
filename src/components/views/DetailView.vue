<script setup lang="ts" generic="TSchema extends RawSchema<object, object>, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, onBeforeUnmount, shallowRef, useSlots, watch } from 'vue'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'
import { isCancelledError } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import type { DetailViewControls, DetailViewDeleteState, DetailViewProps, DetailViewReadyProps, RouteTarget, RawSchema, RawSchemaOutput, SubmitError } from '../../contracts'
import { useFrameworkAdapters } from '../../adapters/projectAdapters'
import { useRecord } from '../core/useRecord'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import Button from '../base/Button.vue'
import Dialog from '../base/Dialog.vue'
import Icon from '../base/Icon.vue'
import ExportPreview from '../../exports/ExportPreview.vue'
import { defaultExportStyles } from '../../exports/defaultStyles'
import { useExport } from '../../exports/useExport'
import { resolveExportFields } from '../../exports/resolveExportFields'
import { inheritExportConfiguration } from '../../exports/inheritConfiguration'
import { createExportSnapshot } from '../../exports/document'
import { composeSourceGuards } from '../../resources/sourceGuard'
import { isConfirmedWriteRefreshError, normalizeWriteError } from '../../resources/postWriteOutcome'
import { stableValue } from '../../query'
import PageHeader from './PageHeader.vue'
import { withCurrentQuery } from './routeQuery'

type TRecord = RawSchemaOutput<TSchema>
type DeleteOutcome = { pending: boolean; refreshing?: boolean; error?: Readonly<SubmitError> }

const props = defineProps<DetailViewProps<TRecord, TContext> & { detail: { schema: TSchema } }>()
const router = useRouter()
const adapters = useFrameworkAdapters()
const detail = computed(() => props.detail)
const reader = useRecord<TRecord, TContext>(() => detail.value)
const defaultBackTo: RouteTarget = { name: 'dashboard' }
const backTo = computed(() => (props.backTo === false ? undefined : (props.backTo ?? defaultBackTo)))

let mounted = true
let deleteRun = 0
const deleteOutcome = shallowRef<DeleteOutcome>()

watch(
  () => [JSON.stringify(stableValue(detail.value.id)), detail.value.resource, props.deleteRecord],
  () => {
    deleteRun += 1
    deleteOutcome.value = undefined
  },
)

onBeforeUnmount(() => {
  mounted = false
  deleteRun += 1
})

const updateTarget = computed<RouteTarget | undefined>(() => {
  const record = reader.record.value
  if (!record || typeof props.updateRoute !== 'function') return undefined
  if (!(props.can?.('update', record) ?? true)) return undefined
  const target = props.updateRoute(record)
  return target === undefined ? undefined : withCurrentQuery(target, router.currentRoute.value.query, router)
})

const canDelete = computed(() => {
  const record = reader.record.value
  if (!record || typeof props.deleteRecord !== 'function') return false
  return props.can?.('delete', record) ?? true
})

async function refreshAfterDelete(error: Readonly<SubmitError>, run: number): Promise<void> {
  if (!isConfirmedWriteRefreshError(error)) return
  const current = deleteOutcome.value
  if (!mounted || run !== deleteRun || current?.error !== error || current.refreshing || current.pending) return
  deleteOutcome.value = { pending: false, refreshing: true, error }
  try {
    await error.refresh()
    if (mounted && run === deleteRun && deleteOutcome.value?.error === error) deleteOutcome.value = undefined
  } catch (recoveryError) {
    if (!mounted || run !== deleteRun || deleteOutcome.value?.error !== error) return
    deleteOutcome.value = { pending: false, refreshing: false, error }
    if (!isCancelledError(recoveryError)) toast.warning('Changes saved. Could not refresh the data.')
  }
}

const deleteState = computed<DetailViewDeleteState>(() => {
  const outcome = deleteOutcome.value
  const error = outcome?.error
  const run = deleteRun
  return {
    disabled: Boolean(outcome?.pending || outcome?.error),
    pending: Boolean(outcome?.pending),
    ...(error ? { error } : {}),
    ...(outcome?.refreshing ? { refreshing: true } : {}),
    ...(error && isConfirmedWriteRefreshError(error) ? { refresh: () => refreshAfterDelete(error, run) } : {}),
  }
})

async function guardedDelete(record: TRecord): Promise<unknown> {
  if (typeof props.deleteRecord !== 'function') throw new Error('DetailView has no delete action.')
  const existing = deleteOutcome.value
  if (existing?.error) throw existing.error
  if (existing?.pending) throw new Error('A delete request is already in progress.')
  const run = ++deleteRun
  deleteOutcome.value = { pending: true }
  try {
    const result = await props.deleteRecord(record)
    if (!mounted || run !== deleteRun) return result
    deleteOutcome.value = undefined
    return result
  } catch (error) {
    const normalized = normalizeWriteError(error, adapters.data.normalizeError)
    if (mounted && run === deleteRun) {
      deleteOutcome.value = normalized.postWrite ? { pending: false, error: Object.freeze(normalized) } : undefined
    }
    throw normalized
  }
}

async function removeRecord(record: TRecord, close: (value: boolean) => void): Promise<void> {
  if (deleteState.value.disabled) return
  const run = deleteRun + 1
  try {
    await guardedDelete(record)
    if (!mounted || run !== deleteRun) return
    close(false)
    toast.success('Record deleted.')
    const destination = props.afterDeleteTo === false ? undefined : (props.afterDeleteTo ?? backTo.value)
    if (destination) {
      await router.replace(withCurrentQuery(destination, router.currentRoute.value.query, router) as RouteLocationRaw)
    }
  } catch (error) {
    if (!mounted || run !== deleteRun) return
    const normalized = normalizeWriteError(error, adapters.data.normalizeError)
    if (isConfirmedWriteRefreshError(normalized)) {
      close(false)
      toast.warning('Changes saved. Could not refresh the data.')
    } else if (!normalized.postWrite) {
      toast.error(normalized.message)
    }
  }
}

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
  updateTarget: updateTarget.value,
  can: props.can,
  deleteRecord: typeof props.deleteRecord === 'function' ? guardedDelete : undefined,
  deleteState: deleteState.value,
}))
const readyProps = computed<DetailViewReadyProps<TRecord, TContext> | undefined>(() => {
  const record = reader.record.value
  if (!record) return undefined
  const { load: _load, data: _data, ...configuration } = detail.value
  return { record, exportControls: exportControls.value, detail: { ...configuration, data: record } }
})
const slots = useSlots()
const detailSlotNames = () => Object.keys(slots).filter((name) => name.startsWith('value:'))
const hasHeaderControls = computed(() =>
  Boolean(slots.controls || updateTarget.value || canDelete.value || exportControls.value.available),
)
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <slot name="header" v-bind="controls" :export-controls="exportControls">
      <PageHeader :title="title ?? ''" :description="description" :back-to="backTo">
        <template v-if="hasHeaderControls" #controls>
          <slot name="controls" v-bind="controls" />
          <template v-if="reader.record.value && updateTarget">
            <slot name="edit-action" :record="reader.record.value" :can="props.can" :target="updateTarget">
              <RouterLink v-slot="{ href, navigate }" custom :to="updateTarget as RouteLocationRaw">
                <Button type="button" variant="outlined" :href="href" @click="navigate">
                  <template #icon><Icon name="edit" size="base" /></template>
                  {{ props.actionLabels?.edit ?? 'Edit' }}
                </Button>
              </RouterLink>
            </slot>
          </template>
          <template v-if="reader.record.value && canDelete">
            <slot name="delete-action" :record="reader.record.value" :can="props.can" :delete-record="guardedDelete" :delete-state="deleteState">
              <Dialog>
                <template #trigger>
                  <Button type="button" variant="outlined" color="error" :disabled="deleteState.disabled">
                    <template #icon><Icon name="delete-bin" size="base" /></template>
                    {{ props.actionLabels?.delete ?? 'Delete' }}
                  </Button>
                </template>
                <template #title>Delete record?</template>
                <template #description>This action cannot be undone.</template>
                <template #footer="{ setOpen }">
                  <div class="flex w-full justify-end gap-2">
                    <Button type="button" variant="text" :disabled="deleteState.pending" @click="setOpen(false)">Cancel</Button>
                    <Button type="button" color="error" :disabled="deleteState.disabled" @click="removeRecord(reader.record.value!, setOpen)">Delete</Button>
                  </div>
                </template>
              </Dialog>
            </slot>
          </template>
          <slot v-if="exportControls.available" name="export-action" :export-controls="exportControls">
            <Button type="button" kind="icon" variant="standard" ariaLabel="Ekspor" :disabled="exportControls.disabled" @click="exportControls.printPdf">
              <template #icon><Icon name="download" size="base" /></template>
            </Button>
          </slot>
          <p v-if="exportControls.error" role="alert">{{ exportControls.error.message }}</p>
        </template>
      </PageHeader>
    </slot>

    <aside v-if="deleteState.error" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
      <div>
        <p v-if="isConfirmedWriteRefreshError(deleteState.error)">Changes saved. The record data could not be refreshed.</p>
        <p v-else>The delete may have completed. Check the record before trying again.</p>
        <p>{{ deleteState.error.message }}</p>
      </div>
      <Button v-if="deleteState.refresh" type="button" variant="text" class="min-w-0 px-3" :disabled="deleteState.refreshing" @click="deleteState.refresh?.()">Retry refresh</Button>
    </aside>

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
