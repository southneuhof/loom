import { createApp, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import Icon from '../Icon.vue'

let app: ReturnType<typeof createApp> | undefined

afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

describe('Icon', () => {
  it('adds variant and suffixless Remix Icon classes', () => {
    const host = document.createElement('div')
    document.body.append(host)
    app = createApp({ render: () => h(Icon, { name: 'link' }) })
    app.mount(host)

    expect(host.firstElementChild?.classList).toContain('ri-link-line')
    expect(host.firstElementChild?.classList).toContain('ri-link')
  })
})
