import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, type App } from 'vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { testAssetAdapter } from '../../inputs/__tests__/harness'
import FileComponent from '../FileComponent.vue'

const asset = {
  kind: 'file' as const,
  id: 'documents/contract.pdf',
  url: 'https://files.test/contract.pdf',
  name: 'contract.pdf',
  mimeType: 'application/pdf',
}
const apps: App[] = []

function mountFileComponent(props: Record<string, unknown>) {
  const errors: unknown[] = []
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({ setup: () => () => h(FileComponent, props) }))
  app.config.errorHandler = (error) => errors.push(error)
  app.use(FrameworkPlugin, {
    adapters: { assets: testAssetAdapter },
    queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
  })
  app.mount(host)
  apps.push(app)
  return { host, errors }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('FileComponent source modes', () => {
  it('rejects every URL or file presentation source in asset mode', () => {
    for (const source of [
      { filename: 'manual.pdf' },
      { ext: 'pdf' },
      { url: 'https://files.test/manual.pdf' },
    ]) {
      const mounted = mountFileComponent({ asset, ...source })

      expect(mounted.errors.some((error) => error instanceof Error && error.message.includes('ASSET_PREVIEW_SOURCE_CONFLICT'))).toBe(true)
    }
  })

  it('uses the canonical asset filename for its preview', () => {
    const mounted = mountFileComponent({ asset })

    expect(mounted.host.textContent).toContain(asset.name)
    expect(mounted.host.textContent).toContain('Preview')
  })

  it('keeps URL-only file presentation with an explicit extension', () => {
    const mounted = mountFileComponent({ filename: 'manual', url: '/manual', ext: 'pdf' })

    expect(mounted.host.textContent).toContain('Preview')
    expect(mounted.errors).toHaveLength(0)
  })
})
