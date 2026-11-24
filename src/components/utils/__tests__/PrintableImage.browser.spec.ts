import { createApp, h } from 'vue'
import { expect, it } from 'vitest'
import { page } from 'vitest/browser'
import PrintableImage from '../PrintableImage.vue'

it('produces a PDF through the print control', async () => {
  let generated: { blob: Blob; filename: string } | undefined
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () => h(PrintableImage, {
      documentTitle: 'loom-print',
      onPDFReady: (blob: Blob, filename: string) => { generated = { blob, filename } },
    }, {
      trigger: ({ handlePrint }: { handlePrint: () => void }) => h('button', { onClick: handlePrint }, 'Generate PDF'),
      content: () => h('p', 'Loom PDF content'),
    }),
  })
  app.mount(host)

  try {
    await page.getByRole('button', { name: 'Generate PDF' }).click()
    await expect.poll(() => generated?.filename).toBe('loom-print.pdf')
    expect(await generated?.blob.slice(0, 5).text()).toBe('%PDF-')
  } finally {
    app.unmount()
    host.remove()
  }
})
