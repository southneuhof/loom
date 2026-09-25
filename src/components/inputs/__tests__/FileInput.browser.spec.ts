import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod'
import type { FormFields } from '../../../contracts/forms'
import Form from '../../core/Form.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import type { AssetAdapter, AssetValue } from '../../../assets/contracts'

type Asset = {
  kind: 'file'
  id: string
  url: string
  name: string
}

const schema = z.object({ file: z.custom<Asset | null>() })
const multiSchema = z.object({ files: z.array(z.custom<Asset>()) })
const requiredFileSchema = z.object({ file: z.custom<Asset | null>().refine((value) => value !== null, 'Choose a file') })
const rejectedFileSchema = z.object({ file: z.custom<Asset | null>().refine((value) => value?.name === 'accepted.pdf', 'Choose an accepted file') })
type Input = z.input<typeof schema>
type MultiInput = z.input<typeof multiSchema>
const fields = { file: { label: 'File', renderer: 'file' } } satisfies FormFields<Input>
const multiFields = { files: { label: 'Files', renderer: 'file', props: { multi: true } } } satisfies FormFields<MultiInput>

function asset(name: string): Asset {
  return {
    kind: 'file',
    id: `/uploads/${name}`,
    url: `https://files.test/${name}`,
    name,
  }
}

function assetsFor(upload: AssetAdapter['upload'] = async () => asset('unused.pdf')): AssetAdapter {
  return {
    read(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const candidate = value as Record<string, unknown>
      if (candidate.kind !== 'file' || typeof candidate.id !== 'string' || typeof candidate.url !== 'string' || typeof candidate.name !== 'string') return null
      return value as AssetValue
    },
    preview(value) {
      return { imageURL: value.url, thumbnailURL: value.url }
    },
    upload,
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
  it('connects the form label and validation message to the file control', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        schema: requiredFileSchema,
        fields,
        initialData: { file: null },
        submit: async () => undefined,
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { adapters: { assets: assetsFor() }, queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await settle()

    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    const errorId = input.getAttribute('aria-describedby')
    expect(input.id).not.toBe('')
    expect(host.querySelector<HTMLLabelElement>('label[for]')?.htmlFor).toBe(input.id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(errorId).not.toBeNull()
    expect(host.querySelector(`#${errorId}[role="alert"]`)?.textContent).toContain('Choose a file')
  })

  it('keeps the form control references after an uploaded asset replaces the drop zone', async () => {
    const upload = async () => asset('rejected.pdf')
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        schema: rejectedFileSchema,
        fields,
        initialData: { file: null },
        submit: async () => undefined,
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { adapters: { assets: assetsFor(upload) }, queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await settle()

    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    const label = host.querySelector<HTMLLabelElement>('label[for]')!
    expect(input.getAttribute('aria-describedby')).not.toBeNull()
    selectFile(input, new File(['rejected'], 'rejected.pdf', { type: 'application/pdf' }))
    await settle()

    const errorId = input.getAttribute('aria-describedby')
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')).toBe(input)
    expect(host.textContent).toContain('rejected.pdf')
    expect(label.htmlFor).toBe(input.id)
    expect(input.id).not.toBe('')
    expect(errorId).not.toBeNull()
    expect(host.ownerDocument.getElementById(input.id)).toBe(input)
    expect(host.ownerDocument.getElementById(errorId!)?.getAttribute('role')).toBe('alert')
    expect(host.ownerDocument.getElementById(errorId!)?.textContent).toContain('Choose an accepted file')
  })

  it('keeps the uploaded asset object visible through the canonical control value', async () => {
    const upload = async () => asset('first.pdf')
    const model = ref<Partial<Input>>({ file: null })
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        schema,
        fields,
        modelValue: model.value,
        'onUpdate:modelValue': (value: Partial<Input>) => { model.value = value },
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { adapters: { assets: assetsFor(upload) }, queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    selectFile(host.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    expect(model.value.file).toMatchObject({ kind: 'file', id: '/uploads/first.pdf' })
    expect(host.textContent).toContain('first.pdf')
  })

  it('uploads sequential multi-file selections and keeps the add controls available', async () => {
    let uploadCount = 0
    const upload = vi.fn(async () => asset(uploadCount++ === 0 ? 'first.pdf' : 'second.pdf'))
    const model = ref<Partial<MultiInput>>({ files: [] })
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        schema: multiSchema,
        fields: multiFields,
        initialData: { files: [] },
        modelValue: model.value,
        'onUpdate:modelValue': (value: Partial<MultiInput>) => { model.value = value },
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { adapters: { assets: assetsFor(upload) }, queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
    selectFile(input, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    expect(model.value.files).toEqual([asset('first.pdf')])
    expect(host.textContent).toContain('first.pdf')
    expect(host.textContent).toContain('Letakkan file anda di sini')
    expect(host.querySelector('input[type="file"]')).toBe(input)
    expect(input.disabled).toBe(false)

    selectFile(input, new File(['second'], 'second.pdf', { type: 'application/pdf' }))
    await settle()

    expect(upload).toHaveBeenCalledTimes(2)
    expect(model.value.files).toEqual([asset('first.pdf'), asset('second.pdf')])
    expect(host.textContent).toContain('first.pdf')
    expect(host.textContent).toContain('second.pdf')
    expect(host.textContent).toContain('Letakkan file anda di sini')
  })

  it('blocks button and Enter submission during a deferred upload, then submits once', async () => {
    let resolveUpload!: (value: Asset) => void
    const upload = () => new Promise<Asset>((resolve) => { resolveUpload = resolve })
    const submit = vi.fn(async () => undefined)
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        schema,
        fields,
        initialData: { file: null },
        submit,
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { adapters: { assets: assetsFor(upload) }, queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    selectFile(host.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    const form = host.querySelector('form')!
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(button.disabled).toBe(true)

    button.click()
    await settle()
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    expect(submit).not.toHaveBeenCalled()

    resolveUpload(asset('first.pdf'))
    await settle()
    expect(button.disabled).toBe(false)

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith({ file: asset('first.pdf') })
  })
})
