import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue'
import { downloadXlsx, print, prepareDocument } from '@southneuhof/spool'
import type { ExportControls, ExportOptions, ExportFormat } from './contracts'

export function useExport<TSnapshot>(options: {
  available: MaybeRefOrGetter<boolean>
  source?: MaybeRefOrGetter<unknown>
  configuration: MaybeRefOrGetter<ExportOptions>
  prepare(signal: AbortSignal): Promise<TSnapshot>
}) {
  const open = ref(false)
  const target = shallowRef<HTMLElement>()
  const snapshot = shallowRef<TSnapshot>() as ShallowRef<TSnapshot | undefined>
  const documentTarget = shallowRef<HTMLElement>()
  let documentReady = false
  let preparedDocument: Awaited<ReturnType<typeof prepareDocument>> | undefined
  const pending = ref(false)
  const error = shallowRef<Error>()
  const configuration = shallowRef<ExportOptions>({})
  let abort: AbortController | undefined
  let active: Promise<void> | undefined
  const formats = computed<readonly ExportFormat[]>(() => toValue(options.configuration).formats ?? ['xlsx', 'pdf'])
  async function prepare() {
    if (!toValue(options.available)) return false
    documentReady = false
    abort?.abort()
    abort = new AbortController()
    const signal = abort.signal
    const value = await options.prepare(signal)
    signal.throwIfAborted()
    snapshot.value = value
    configuration.value = { ...toValue(options.configuration) }
    await nextTick()
    if (!target.value) throw new Error('[loom] Export template is not ready.')
    const prepared = await prepareDocument({ target: target.value, orientation: configuration.value.orientation, styles: configuration.value.styles, signal })
    signal.throwIfAborted()
    preparedDocument?.dispose()
    preparedDocument = prepared
    documentTarget.value = prepared.target
    documentReady = true
    return true
  }
  function run(operation: () => Promise<void>) {
    if (active) return active
    if (!toValue(options.available) || !formats.value.length) return Promise.resolve()
    pending.value = true
    error.value = undefined
    active = operation().catch((cause: unknown) => {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) error.value = cause instanceof Error ? cause : new Error(String(cause))
    }).finally(() => { pending.value = false; active = undefined })
    return active
  }
  async function output(format: 'pdf' | 'xlsx') {
    if (!formats.value.includes(format)) return
    if (!documentReady && !await prepare()) return
    const element = documentTarget.value
    if (!element) throw new Error('[loom] Export template is not ready.')
    if (format === 'pdf') await print({ target: element, orientation: configuration.value.orientation, title: configuration.value.filename, styles: configuration.value.styles })
    else await downloadXlsx(element, { orientation: configuration.value.orientation, filename: configuration.value.filename, styles: configuration.value.styles })
  }
  const controls = computed<ExportControls>(() => ({
    available: toValue(options.available) && formats.value.length > 0,
    disabled: pending.value || !toValue(options.available),
    pending: pending.value,
    error: error.value,
    formats: formats.value,
    openPreview: () => run(async () => { if (await prepare()) open.value = true }),
    printPdf: () => run(() => output('pdf')),
    downloadXlsx: () => run(() => output('xlsx')),
  }))
  if (options.source) watch(() => toValue(options.source), () => {
    abort?.abort()
    documentReady = false
    if (open.value) void Promise.resolve(active).then(() => run(async () => { await prepare() }))
    else {
      snapshot.value = undefined
      documentTarget.value = undefined
      preparedDocument?.dispose()
      preparedDocument = undefined
    }
  }, { deep: true })
  onBeforeUnmount(() => { abort?.abort(); preparedDocument?.dispose() })
  return { controls, open, target, documentTarget, snapshot, configuration, reportError(cause: Error) { error.value = cause } }
}
