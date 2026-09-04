import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

type ColumnSizes = Record<string, number>

function canStore() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function read<T>(key: string, fallback: T): T {
  if (!canStore()) return fallback
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null')
    return value == null ? fallback : value as T
  } catch {
    return fallback
  }
}

/** Namespace-scoped, SSR-safe column preferences. */
export function useTablePreferences(namespace: MaybeRefOrGetter<string | undefined>, fieldKeys: MaybeRefOrGetter<readonly string[]>, minWidth: MaybeRefOrGetter<number>) {
  const sizes = ref<ColumnSizes>({})
  const visibleKeys = ref<string[]>([])
  let visiblePersistTimer: ReturnType<typeof setTimeout> | undefined
  const storageKey = (name: string) => {
    const scope = toValue(namespace)
    return scope ? `is-framework:${scope}:table:${name}` : undefined
  }
  const normalize = () => {
    const keys = [...toValue(fieldKeys)]
    const minimum = toValue(minWidth)
    const sizeKey = storageKey('column-sizes')
    const visibleKey = storageKey('visible-columns')
    const storedSizes = sizeKey ? read<unknown>(sizeKey, {}) : {}
    sizes.value = Object.fromEntries(Object.entries(storedSizes as Record<string, unknown>)
      .filter(([key, value]) => keys.includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= minimum)
      .map(([key, value]) => [key, value as number])) as ColumnSizes
    const storedVisible = visibleKey ? read<unknown>(visibleKey, keys) : keys
    if (Array.isArray(storedVisible)) visibleKeys.value = keys.filter((key) => storedVisible.includes(key))
    else if (storedVisible && typeof storedVisible === 'object' && Array.isArray((storedVisible as { visible?: unknown }).visible) && Array.isArray((storedVisible as { known?: unknown }).known)) {
      const { visible, known } = storedVisible as { visible: string[]; known: string[] }
      visibleKeys.value = keys.filter((key) => !known.includes(key) || visible.includes(key))
    } else visibleKeys.value = keys
  }
  const persistSizes = () => {
    const key = storageKey('column-sizes')
    if (!key || !canStore()) return
    window.localStorage.setItem(key, JSON.stringify(sizes.value))
  }
  const persistVisible = () => {
    const key = storageKey('visible-columns')
    if (!key || !canStore()) return
    window.localStorage.setItem(key, JSON.stringify({ known: [...toValue(fieldKeys)], visible: visibleKeys.value }))
  }
  const cancelVisiblePersist = () => {
    if (visiblePersistTimer === undefined) return
    clearTimeout(visiblePersistTimer)
    visiblePersistTimer = undefined
  }
  const scheduleVisiblePersist = () => {
    cancelVisiblePersist()
    if (!storageKey('visible-columns') || !canStore()) return
    visiblePersistTimer = setTimeout(() => {
      visiblePersistTimer = undefined
      persistVisible()
    }, 200)
  }
  function setVisible(next: readonly string[]) {
    visibleKeys.value = [...toValue(fieldKeys)].filter((key) => next.includes(key))
    scheduleVisiblePersist()
  }
  function setSizes(next: ColumnSizes) {
    sizes.value = next
    persistSizes()
  }
  function resetColumns() {
    cancelVisiblePersist()
    const sizeKey = storageKey('column-sizes')
    const visibleKey = storageKey('visible-columns')
    if (canStore()) {
      if (sizeKey) window.localStorage.removeItem(sizeKey)
      if (visibleKey) window.localStorage.removeItem(visibleKey)
    }
    sizes.value = {}
    visibleKeys.value = [...toValue(fieldKeys)]
  }
  onBeforeUnmount(() => {
    if (visiblePersistTimer === undefined) return
    cancelVisiblePersist()
    persistVisible()
  })
  watch([() => toValue(namespace), () => [...toValue(fieldKeys)].join('|'), () => toValue(minWidth)], normalize, { immediate: true })
  return { sizes, visibleKeys, setSizes, setVisible, resetColumns }
}
