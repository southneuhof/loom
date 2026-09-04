import { createApp, defineComponent, h, nextTick, ref, type App, type Component } from 'vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import type { FrameworkAdaptersInput } from '../../../adapters/projectAdapters'

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
  app.use(FrameworkPlugin, { adapters: options.adapters })
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
