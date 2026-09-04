import { createApp, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import ImagePreview from '../ImagePreview.vue'
import ImagePreviewMulti from '../ImagePreviewMulti.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

function mount(component: any, props: Record<string, unknown>, slots: Record<string, any> = {}) {
  const host = document.createElement('div')
  document.body.append(host)

  const app = createApp({
    render() {
      return h(component, props, slots)
    },
  })

  mounted.push(app)
  app.mount(host)

  return { host }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('ImagePreview', () => {
  it('opens from the thumbnail and closes from the close button', async () => {
    const { host } = mount(
      ImagePreview,
      { imageURL: '/full.png', thumbnailURL: '/thumb.png' },
      { 'image-detail': () => h('div', { 'data-testid': 'image-detail' }, 'Full image') },
    )

    ;(host.querySelector('button') as HTMLButtonElement).click()
    await nextTick()

    expect(document.body.querySelector('[data-testid="image-detail"]')?.textContent).toBe('Full image')

    ;(document.body.querySelector('[data-testid="image-preview-close"]') as HTMLButtonElement).click()
    await nextTick()

    expect(document.body.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('closed')
  })
})

describe('ImagePreviewMulti', () => {
  it('opens selected image and navigates next/previous', async () => {
    const { host } = mount(ImagePreviewMulti, {
      images: [
        { url: '/one.png', thumbnail: '/one-thumb.png' },
        { url: '/two.png', thumbnail: '/two-thumb.png' },
      ],
    })

    ;(host.querySelector('button') as HTMLButtonElement).click()
    await nextTick()

    expect((document.body.querySelector('img[src="/one.png"]') as HTMLImageElement | null)).toBeTruthy()

    const buttons = [...document.body.querySelectorAll('button')] as HTMLButtonElement[]
    buttons[buttons.length - 1].click()
    await nextTick()

    expect((document.body.querySelector('img[src="/two.png"]') as HTMLImageElement | null)).toBeTruthy()

    buttons[buttons.length - 2].click()
    await nextTick()

    expect((document.body.querySelector('img[src="/one.png"]') as HTMLImageElement | null)).toBeTruthy()
  })
})
