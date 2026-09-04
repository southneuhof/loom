import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import Form from '../../core/Form.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'

type Asset = {
  kind: 'file'
  id: string
  url: string
  name: string
}

function asset(name: string): Asset {
  return {
    kind: 'file',
    id: `/uploads/${name}`,
    url: `https://files.test/${name}`,
    name,
  }
}

const apps: App[] = []

async function settle() {
  await Promise.resolve()
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

function selectFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('FileInput browser behavior', () => {
  it('keeps the uploaded file visible when a controlled form stores its identity', async () => {
    const upload = async () => asset('first.pdf')
    const model = ref<Record<string, unknown>>({ file: null })
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        fields: {
          file: {
            label: 'File',
            form: {
              renderer: 'file',
              props: { upload },
              write: (value: unknown) => {
                const file = value as { id?: unknown }
                return typeof file?.id === 'string' ? file.id : value
              },
            },
          },
        },
        modelValue: model.value,
        'onUpdate:modelValue': (value: Record<string, unknown>) => { model.value = value },
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    selectFile(host.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    expect(model.value.file).toMatchObject({ kind: 'file', id: '/uploads/first.pdf' })
    expect(host.textContent).toContain('first.pdf')
  })
})
