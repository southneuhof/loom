import { createApp, defineComponent, h, nextTick, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import type { FrameworkAdaptersInput } from '../../../adapters/projectAdapters'
import type { RendererRegistriesInput } from '../../../renderers/registry'
import type { FrameworkFieldDefaultsInput } from '../../../fields'
import type { InputPropsRegistry } from '../../../renderers/inputProps'
import type { FrameworkUiDefaultsInput } from '../../views/uiDefaults'

export interface MountOptions {
  adapters?: FrameworkAdaptersInput
  renderers?: RendererRegistriesInput
  fieldDefaults?: FrameworkFieldDefaultsInput
  inputProps?: InputPropsRegistry
  uiDefaults?: FrameworkUiDefaultsInput
  slots?: Record<string, (scope: Record<string, unknown>) => unknown>
}

export function mountCore(component: Component, props: Record<string, unknown>, options: MountOptions = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let exposed: Record<string, unknown> | undefined

  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          h(component, { ...props, ref: (instance: unknown) => (exposed = instance as Record<string, unknown>) }, options.slots)
      },
    }),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', name: 'test-route', component: { render: () => null } }],
  })
  app.use(router)
  app.use(FrameworkPlugin, {
    adapters: options.adapters,
    fieldDefaults: options.fieldDefaults,
    renderers: options.renderers,
    inputProps: options.inputProps,
    uiDefaults: options.uiDefaults,
    queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
  })
  app.mount(host)

  return {
    app,
    router,
    host,
    exposed: () => exposed!,
    text: () => host.textContent ?? '',
    find: <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector),
    all: (selector: string) => [...host.querySelectorAll(selector)],
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

export async function flush(times = 6) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
