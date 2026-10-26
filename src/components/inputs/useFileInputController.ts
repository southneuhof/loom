import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import type { MaybePromise, UploadContext, UploadOperation, UploadProgress } from '../../contracts'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import { frameworkAdaptersKey } from '../../adapters/projectAdapters'
import { useFormInputPending } from '../core/useFormInputState'
import type { FileInputMode, FileInputModelValue, FileTransform } from './fileInput.types'

export type FileInputValue =
  | { kind: 'file'; file: File }
  | { kind: 'asset'; asset: AssetValue }

export type FileInputRow =
  | { id: string; kind: 'value'; value: FileInputValue }
  | { id: string; kind: 'pending'; file?: File; stage: 'reading' | 'preparing' | 'transforming' | 'uploading'; progress?: UploadProgress }
  | { id: string; kind: 'invalid' }

type FileRules = {
  accept: readonly string[]
  maxSize: number
  imageOnly: boolean
}

type OperationBase = {
  id: string
  generation: number
  controller: AbortController
  pending: ReturnType<ReturnType<typeof useFormInputPending>['begin']>
  complete: (accepted: boolean) => void
  mode: FileInputMode
  multi: boolean
  rules: FileRules
  stage: 'reading' | 'preparing' | 'transforming' | 'uploading'
  file?: File
  progress?: UploadProgress
}

type FileSource =
  | { kind: 'file'; file: File }
  | { kind: 'acquire'; acquire: (signal: AbortSignal) => MaybePromise<File> }

type FileOperation = OperationBase & {
  kind: 'file'
  source: FileSource
  transform?: FileTransform
  upload?: UploadOperation<AssetValue>
  destination?: string
}

type StoredAssetOperation = OperationBase & {
  kind: 'stored-asset'
  acquire: () => MaybePromise<unknown>
}

type Operation = FileOperation | StoredAssetOperation

export interface FileInputControllerOptions {
  mode: () => FileInputMode
  multi: () => boolean
  accept: () => readonly string[]
  maxSize: () => number
  limit: () => number | undefined
  disabled: () => boolean
  imageOnly?: boolean
  destination: () => string | undefined
  transform: () => FileTransform | undefined
  upload: () => FileOperation['upload'] | undefined
  modelValue: () => unknown
  setModelValue: (value: FileInputModelValue<FileInputMode, boolean>) => void
  error: () => string | undefined
  validationError: (message: string | undefined) => void
  validationTouch: () => void
}

type ParsedModel = { values: FileInputValue[]; error?: string }

const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.heic', '.heif', '.jpeg', '.jpg', '.png', '.svg', '.tif', '.tiff', '.webp'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File
}

function isImage(name: string, mimeType: string | undefined): boolean {
  if (mimeType?.toLowerCase().startsWith('image/')) return true
  const suffix = name.slice(name.lastIndexOf('.')).toLowerCase()
  return imageExtensions.has(suffix)
}

function matchesAccept(name: string, mimeType: string | undefined, accept: readonly string[]): boolean {
  const normalizedMime = mimeType?.trim().toLowerCase() ?? ''
  const normalizedName = name.toLowerCase()
  return accept.some((entry) => {
    const candidate = entry.trim().toLowerCase()
    if (candidate.startsWith('.')) return normalizedName.endsWith(candidate)
    if (candidate.endsWith('/*')) {
      const prefix = candidate.slice(0, -1)
      return normalizedMime.startsWith(prefix) || (prefix === 'image/' && isImage(name, mimeType))
    }
    return normalizedMime === candidate
  })
}

function sameAsset(left: AssetValue, right: AssetValue): boolean {
  return left.kind === right.kind
    && left.id === right.id
    && left.url === right.url
    && left.name === right.name
    && left.size === right.size
    && left.mimeType === right.mimeType
    && left.updatedAt === right.updatedAt
    && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)
}

function sameInputValue(left: FileInputValue, right: FileInputValue): boolean {
  if (left.kind !== right.kind) return false
  return left.kind === 'file' && right.kind === 'file'
    ? left.file === right.file
    : left.kind === 'asset' && right.kind === 'asset' && sameAsset(left.asset, right.asset)
}

function sameInputValues(left: readonly FileInputValue[], right: readonly FileInputValue[]): boolean {
  return left.length === right.length && left.every((value, index) => {
    const other = right[index]
    return other !== undefined && sameInputValue(value, other)
  })
}

function assetErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (isRecord(reason) && typeof reason.message === 'string') return reason.message
  return String(reason)
}

export function useFileInputController(options: FileInputControllerOptions) {
  const assets = useAssetAdapter({ optional: true })
  const adapters = inject(frameworkAdaptersKey, null)
  const inputPending = useFormInputPending()
  const rows = ref<FileInputRow[]>([])
  const inputError = ref<string>()
  const invalidModel = ref(false)
  const pending = computed(() => rows.value.some((row) => row.kind === 'pending'))
  const pendingCount = computed(() => rows.value.filter((row) => row.kind === 'pending').length)
  const values = computed(() => rows.value.flatMap((row) => row.kind === 'value' ? [row.value] : []))
  const operations = new Map<string, Operation>()
  let operationSequence = 0
  let rowSequence = 0
  let generation = 0
  let disposed = false
  let modelError: string | undefined
  let targetValues: FileInputValue[] = []

  if (options.mode() === 'asset' && !assets) throw new Error('[loom] ASSET_ADAPTER_REQUIRED')

  function nextRowId(): string {
    rowSequence += 1
    return `file-input-${rowSequence}`
  }

  function setError(message: string | undefined): void {
    inputError.value = message
    options.validationError(message)
  }

  function failureMessage(reason: unknown, mode: FileInputMode): string {
    if (mode === 'asset' && adapters) {
      try {
        const normalized = adapters.data.normalizeError(reason)
        if (normalized.message) return normalized.message
      } catch {
        return assetErrorMessage(reason)
      }
    }
    return assetErrorMessage(reason)
  }

  function makeFileRules(): FileRules {
    return {
      accept: [...options.accept()],
      maxSize: options.maxSize(),
      imageOnly: options.imageOnly === true,
    }
  }

  function validateFile(file: File, rules: FileRules): string | undefined {
    if (rules.imageOnly && !isImage(file.name, file.type)) return 'Choose an image file.'
    if (rules.accept.length > 0 && !matchesAccept(file.name, file.type, rules.accept)) {
      return `The selected file type is not accepted. Choose ${rules.accept.join(', ')}.`
    }
    if (file.size > rules.maxSize * 1_000_000) return `The file exceeds the ${rules.maxSize} MB limit.`
    return undefined
  }

  function validateAsset(asset: AssetValue, rules: FileRules): string | undefined {
    if (rules.imageOnly && !isImage(asset.name, asset.mimeType)) return 'Choose an image file.'
    if (rules.accept.length > 0 && !matchesAccept(asset.name, asset.mimeType, rules.accept)) {
      return `The selected file type is not accepted. Choose ${rules.accept.join(', ')}.`
    }
    if (typeof asset.size === 'number' && asset.size > rules.maxSize * 1_000_000) {
      return `The file exceeds the ${rules.maxSize} MB limit.`
    }
    return undefined
  }

  function parseValue(value: unknown, mode: FileInputMode, rules: FileRules): FileInputValue | undefined {
    if (mode === 'file') {
      if (!isFile(value)) return undefined
      if (rules.imageOnly && !isImage(value.name, value.type)) return undefined
      return { kind: 'file', file: value }
    }
    if (!assets) return undefined
    const asset = assets.read(value)
    if (!asset || (rules.imageOnly && !isImage(asset.name, asset.mimeType))) return undefined
    return { kind: 'asset', asset }
  }

  function parseModel(value: unknown): ParsedModel {
    if (value === undefined || value === null) return { values: [] }
    const multi = options.multi()
    if (Array.isArray(value) !== multi) {
      return { values: [], error: multi ? 'This field requires an array value.' : 'This field requires one value.' }
    }
    const candidates: unknown[] = Array.isArray(value) ? value : [value]
    const parsed = candidates.map((candidate) => parseValue(candidate, options.mode(), makeFileRules()))
    if (parsed.some((candidate) => candidate === undefined)) {
      return { values: parsed.filter((candidate): candidate is FileInputValue => candidate !== undefined), error: options.mode() === 'asset' ? 'Invalid asset value.' : 'The value does not match file mode.' }
    }
    return { values: parsed.filter((candidate): candidate is FileInputValue => candidate !== undefined) }
  }

  function ownedValues(): FileInputValue[] {
    return rows.value.flatMap((row) => row.kind === 'value' ? [row.value] : [])
  }

  function modelValueFor(valuesToWrite: readonly FileInputValue[]): FileInputModelValue<FileInputMode, boolean> {
    if (options.mode() === 'file') {
      const files = valuesToWrite.flatMap((value) => value.kind === 'file' ? [value.file] : [])
      if (files.length !== valuesToWrite.length) throw new Error('[loom] File input value mode changed before commit.')
      return options.multi() ? files : files[0] ?? null
    }
    const storedAssets = valuesToWrite.flatMap((value) => value.kind === 'asset' ? [value.asset] : [])
    if (storedAssets.length !== valuesToWrite.length) throw new Error('[loom] Asset input value mode changed before commit.')
    return options.multi() ? storedAssets : storedAssets[0] ?? null
  }

  function writeModel(): void {
    const current = ownedValues()
    targetValues = current
    options.setModelValue(modelValueFor(current))
  }

  function parsedRows(parsed: ParsedModel): FileInputRow[] {
    const result: FileInputRow[] = parsed.values.map((value) => ({ id: nextRowId(), kind: 'value', value }))
    if (parsed.error) result.push({ id: nextRowId(), kind: 'invalid' })
    return result
  }

  function isCurrent(operation: Operation): boolean {
    return !disposed
      && operations.get(operation.id) === operation
      && operation.generation === generation
      && !operation.pending.released()
  }

  function finish(operation: Operation, accepted: boolean): void {
    if (operations.get(operation.id) !== operation) return
    operations.delete(operation.id)
    operation.pending.release()
    operation.complete(accepted)
  }

  function cancel(operation: Operation): void {
    if (operations.get(operation.id) !== operation) return
    operations.delete(operation.id)
    operation.controller.abort()
    operation.pending.release()
    operation.complete(false)
    rows.value = rows.value.filter((row) => row.kind !== 'pending' || row.id !== operation.id)
  }

  function cancelAll(): void {
    generation += 1
    for (const operation of [...operations.values()]) cancel(operation)
  }

  function setStage(operation: Operation, stage: Operation['stage'], file?: File): void {
    operation.stage = stage
    if (file) operation.file = file
    const row = rows.value.find((candidate) => candidate.kind === 'pending' && candidate.id === operation.id)
    if (row?.kind === 'pending') {
      row.stage = stage
      row.file = operation.file
    }
  }

  function reportProgress(operation: FileOperation, progress: UploadProgress): void {
    if (!isCurrent(operation)) return
    operation.progress = progress
    const row = rows.value.find((candidate) => candidate.kind === 'pending' && candidate.id === operation.id)
    if (row?.kind === 'pending') row.progress = progress
  }

  function commit(operation: Operation, value: FileInputValue): void {
    if (!isCurrent(operation)) return
    const currentError = inputError.value
    const nextRow: FileInputRow = { id: operation.id, kind: 'value', value }
    if (operation.multi) {
      rows.value = rows.value.map((row) => row.kind === 'pending' && row.id === operation.id ? nextRow : row)
    } else {
      rows.value = [nextRow]
    }
    writeModel()
    if (currentError !== undefined) setError(currentError)
    options.validationTouch()
  }

  function removePending(operation: Operation): void {
    rows.value = rows.value.filter((row) => row.kind !== 'pending' || row.id !== operation.id)
  }

  function startOperation<TOperation extends Operation>(operation: TOperation): Promise<boolean> {
    operations.set(operation.id, operation)
    rows.value = [...rows.value, {
      id: operation.id,
      kind: 'pending',
      file: operation.file,
      stage: operation.stage,
      progress: operation.progress,
    }]
    void (async () => {
      let accepted = false
      try {
        if (operation.kind === 'file') {
          let file = operation.source.kind === 'file'
            ? operation.source.file
            : await operation.source.acquire(operation.controller.signal)
          if (!isCurrent(operation)) return
          const sourceError = validateFile(file, operation.rules)
          if (sourceError) throw new Error(sourceError)
          setStage(operation, operation.transform ? 'transforming' : operation.mode === 'asset' ? 'uploading' : 'preparing', file)
          if (operation.transform) file = await operation.transform(file, { signal: operation.controller.signal })
          if (!isCurrent(operation)) return
          if (!isFile(file)) throw new Error('The transform must return a File.')
          const transformedError = validateFile(file, operation.rules)
          if (transformedError) throw new Error(transformedError)
          if (operation.mode === 'file') {
            commit(operation, { kind: 'file', file })
            accepted = true
            return
          }
          const upload = operation.upload ?? assets?.upload
          if (!upload || !assets) throw new Error('[loom] ASSET_ADAPTER_REQUIRED')
          setStage(operation, 'uploading', file)
          const uploaded = await upload(file, {
            destination: operation.destination,
            signal: operation.controller.signal,
            onProgress: (progress) => reportProgress(operation, progress),
          })
          if (!isCurrent(operation)) return
          const asset = assets.read(uploaded)
          if (!asset) throw new Error('The upload returned an invalid asset.')
          const assetError = validateAsset(asset, operation.rules)
          if (assetError) throw new Error(assetError)
          commit(operation, { kind: 'asset', asset })
          accepted = true
        } else {
          const value = await operation.acquire()
          if (!isCurrent(operation)) return
          if (options.disabled()) {
            removePending(operation)
            return
          }
          if (!assets) throw new Error('[loom] ASSET_ADAPTER_REQUIRED')
          const asset = assets.read(value)
          if (!asset) throw new Error('Invalid asset value.')
          const assetError = validateAsset(asset, operation.rules)
          if (assetError) throw new Error(assetError)
          commit(operation, { kind: 'asset', asset })
          accepted = true
        }
      } catch (reason) {
        if (!isCurrent(operation)) return
        removePending(operation)
        setError(failureMessage(reason, operation.mode))
      } finally {
        finish(operation, accepted)
      }
    })()
    return new Promise((resolve) => {
      const current = operations.get(operation.id)
      if (!current) {
        resolve(false)
        return
      }
      operation.complete = resolve
    })
  }

  function operationBase(stage: Operation['stage'], mode = options.mode(), multi = options.multi()): OperationBase {
    operationSequence += 1
    return {
      id: `file-operation-${operationSequence}`,
      generation,
      controller: new AbortController(),
      pending: inputPending.begin(),
      complete: () => undefined,
      mode,
      multi,
      rules: makeFileRules(),
      stage,
    }
  }

  function countCanAccept(candidateCount: number, multi: boolean): boolean {
    const limit = options.limit()
    if (limit === undefined) return true
    if (!multi) return candidateCount <= limit
    return ownedValues().length + pendingCount.value + candidateCount <= limit
  }

  function acceptFiles(files: readonly File[]): void {
    if (disposed || options.disabled() || invalidModel.value || files.length === 0) return
    if (!options.multi() && pending.value) return
    if (!options.multi() && files.length !== 1) {
      setError('Select one file at a time.')
      return
    }
    if (!countCanAccept(files.length, options.multi())) {
      setError(`Select no more than ${options.limit()} files.`)
      return
    }
    const rules = makeFileRules()
    const issue = files.map((file) => validateFile(file, rules)).find((message) => message !== undefined)
    if (issue) {
      setError(issue)
      return
    }
    setError(undefined)
    if (!options.multi()) cancelAll()
    if (options.mode() === 'file' && !options.transform()) {
      const next = files.map((file) => ({ id: nextRowId(), kind: 'value' as const, value: { kind: 'file' as const, file } }))
      rows.value = options.multi() ? [...rows.value, ...next] : next
      writeModel()
      options.validationTouch()
      return
    }
    for (const file of files) {
      const base = operationBase(options.transform() ? 'transforming' : options.mode() === 'asset' ? 'uploading' : 'preparing')
      const operation: FileOperation = {
        ...base,
        kind: 'file',
        source: { kind: 'file', file },
        transform: options.transform(),
        upload: options.upload(),
        destination: options.destination(),
      }
      void startOperation(operation)
    }
  }

  function acquireFile(acquire: (signal: AbortSignal) => MaybePromise<File>): Promise<boolean> {
    if (disposed || options.disabled() || invalidModel.value || (!options.multi() && pending.value) || !countCanAccept(1, options.multi())) return Promise.resolve(false)
    if (!options.multi()) cancelAll()
    setError(undefined)
    const base = operationBase('reading')
    const operation: FileOperation = {
      ...base,
      kind: 'file',
      source: { kind: 'acquire', acquire },
      transform: options.transform(),
      upload: options.upload(),
      destination: options.destination(),
    }
    return startOperation(operation)
  }

  function acquireStoredAsset(acquire: () => MaybePromise<unknown>): Promise<boolean> {
    if (disposed || options.disabled() || invalidModel.value || options.mode() !== 'asset' || (!options.multi() && pending.value)) return Promise.resolve(false)
    if (!countCanAccept(1, options.multi())) {
      setError(`Select no more than ${options.limit()} files.`)
      return Promise.resolve(false)
    }
    if (!options.multi()) cancelAll()
    setError(undefined)
    const base = operationBase('reading', 'asset')
    const operation: StoredAssetOperation = { ...base, kind: 'stored-asset', acquire }
    return startOperation(operation)
  }

  function remove(id: string): void {
    if (disposed || options.disabled() || invalidModel.value) return
    const operation = operations.get(id)
    if (operation) {
      cancel(operation)
      return
    }
    const next = rows.value.filter((row) => row.id !== id)
    if (next.length === rows.value.length) return
    rows.value = next
    writeModel()
    options.validationTouch()
  }

  function clear(): void {
    if (disposed || options.disabled()) return
    cancelAll()
    rows.value = []
    invalidModel.value = false
    modelError = undefined
    setError(undefined)
    options.setModelValue(options.multi() ? [] : null)
    targetValues = []
    options.validationTouch()
  }

  function clearInvalid(): void {
    if (disposed || options.disabled()) return
    const next = rows.value.filter((row) => row.kind !== 'invalid')
    if (next.length === rows.value.length && !invalidModel.value) return
    rows.value = next
    invalidModel.value = false
    modelError = undefined
    setError(undefined)
    writeModel()
    options.validationTouch()
  }

  function reorder(ids: readonly string[]): void {
    if (disposed || options.disabled() || invalidModel.value || pending.value || !options.multi()) return
    const currentValues = rows.value.filter((row): row is Extract<FileInputRow, { kind: 'value' }> => row.kind === 'value')
    if (ids.length !== currentValues.length || new Set(ids).size !== ids.length) return
    const byId = new Map(currentValues.map((row) => [row.id, row]))
    if (ids.some((id) => !byId.has(id))) return
    rows.value = ids.flatMap((id) => {
      const row = byId.get(id)
      return row ? [row] : []
    })
    writeModel()
    options.validationTouch()
  }

  function syncModel(value: unknown): void {
    let parsed: ParsedModel
    try {
      parsed = parseModel(value)
    } catch (reason) {
      parsed = { values: [], error: failureMessage(reason, options.mode()) }
    }
    if (sameInputValues(parsed.values, targetValues) && parsed.error === modelError) return
    cancelAll()
    targetValues = parsed.values
    modelError = parsed.error
    invalidModel.value = parsed.error !== undefined
    rows.value = parsedRows(parsed)
    setError(parsed.error)
  }

  watch(options.modelValue, syncModel, { immediate: true, flush: 'sync' })
  watch(() => [options.mode(), options.multi(), options.accept(), options.maxSize(), options.limit(), options.transform(), options.upload(), options.destination()], () => {
    cancelAll()
    if (!modelError) setError(undefined)
    syncModel(options.modelValue())
  }, { flush: 'sync' })
  watch(options.error, (next, previous) => {
    if (previous && !next && inputError.value) inputError.value = undefined
  }, { flush: 'sync' })

  onBeforeUnmount(() => {
    disposed = true
    cancelAll()
  })

  return {
    rows,
    values,
    pending,
    pendingCount,
    inputError,
    invalidModel,
    acceptFiles,
    acquireFile,
    acquireStoredAsset,
    remove,
    clear,
    clearInvalid,
    reorder,
    reportError: (reason: unknown) => setError(failureMessage(reason, options.mode())),
    assetPreview: (asset: AssetValue) => assets?.preview(asset),
  }
}
