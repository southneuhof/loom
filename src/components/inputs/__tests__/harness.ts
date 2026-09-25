import { createApp, defineComponent, h, nextTick, ref, type App, type Component } from 'vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import type { FrameworkAdaptersInput } from '../../../adapters/projectAdapters'
import type { AssetAdapter, AssetValue } from '../../../assets/contracts'

export const testAssetAdapter: AssetAdapter = {
  read(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const asset = value as Record<string, unknown>
    if (asset.kind !== 'file' || typeof asset.id !== 'string' || typeof asset.url !== 'string' || typeof asset.name !== 'string') return null
    return value as AssetValue
  },
  preview(asset) {
    return { imageURL: asset.url, thumbnailURL: asset.url }
  },
  async upload() {
    throw new Error('Test asset upload is not configured.')
  },
}

export function mountInput<T>(component: Component, options: {
  model: T
  props?: Record<string, unknown>
  adapters?: FrameworkAdaptersInput
}) {
  const model = ref(options.model)
  const props = ref(options.props ?? {})
  const host = document.createElement('div')
  const app: App = createApp(defineComponent({
    setup: () => () => h(component, {
      ...props.value,
      modelValue: model.value,
      'onUpdate:modelValue': (value: T) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin, { adapters: { assets: testAssetAdapter, ...options.adapters } })
  app.mount(host)
  return {
    app,
    host,
    model,
    setProps(value: Record<string, unknown>) { props.value = { ...props.value, ...value } },
    async flush() {
      await Promise.resolve()
      await nextTick()
      await Promise.resolve()
      await nextTick()
    },
    cleanup() {
      app.unmount()
      host.remove()
    },
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
