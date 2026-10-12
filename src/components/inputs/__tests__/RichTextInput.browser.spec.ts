import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import tinymce from 'tinymce/tinymce'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import RichTextInput from '../RichTextInput.vue'

const apps: App[] = []

async function settle() {
  await nextTick()
  await Promise.resolve()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('RichTextInput live control links', () => {
  it('updates iframe descriptions without replacing editor content or focus', async () => {
    const helper = ref('Initial helper.')
    const error = ref('Initial error.')
    const content = ref('Persistent editor text.')
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(RichTextInput, {
        id: 'rich-text-control',
        label: 'Description',
        helperMessage: helper.value,
        error: error.value,
        'aria-describedby': 'authored-description',
        modelValue: content.value,
        'onUpdate:modelValue': (value: string) => { content.value = value },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    let frame: HTMLIFrameElement | null = null
    await vi.waitFor(() => {
      frame = host.querySelector('iframe')
      expect(frame).not.toBeNull()
      expect(tinymce.get('rich-text-control')).toBeDefined()
    }, { timeout: 15000 })

    const editor = tinymce.get('rich-text-control')!
    const originalFrame = frame!
    const initialDescriptions = originalFrame.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const initialHelper = host.querySelector<HTMLElement>('[id$="-helper"]')!
    const initialError = host.querySelector<HTMLElement>('[role="alert"]')!
    expect(initialDescriptions).toContain('authored-description')
    expect(initialDescriptions).toContain(initialHelper.id)
    expect(initialDescriptions).toContain(initialError.id)
    expect(originalFrame.getAttribute('aria-invalid')).toBe('true')

    originalFrame.focus()
    expect(document.activeElement).toBe(originalFrame)

    error.value = ''
    helper.value = 'Updated helper.'
    await vi.waitFor(async () => {
      await settle()
      expect(originalFrame.getAttribute('aria-invalid')).toBeNull()
      expect(originalFrame.getAttribute('aria-describedby')).not.toContain(initialError.id)
    })

    const updatedDescriptions = originalFrame.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    expect(updatedDescriptions).toContain('authored-description')
    expect(updatedDescriptions).toContain(initialHelper.id)
    expect(updatedDescriptions).not.toContain(initialError.id)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelector('iframe')).toBe(originalFrame)
    expect(tinymce.get('rich-text-control')).toBe(editor)
    expect(editor.getContent()).toContain('Persistent editor text.')
    expect(document.activeElement).toBe(originalFrame)

    app.unmount()
    await vi.waitFor(() => expect(tinymce.get('rich-text-control')).toBeNull())
  })
})
