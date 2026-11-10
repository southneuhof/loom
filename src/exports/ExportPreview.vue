<script setup lang="ts" generic="TRecord extends object, TContext extends object">
import { nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { prepareDocument } from '@southneuhof/spool'
import type { ExportControls, ExportOptions, ExportFormat } from './contracts'
import type { ViewExportSnapshot } from './document'
import ExportBody from './ExportBody.vue'
import Dialog from '../components/base/Dialog.vue'
import Button from '../components/base/Button.vue'
const props = defineProps<{ snapshot?: ViewExportSnapshot<TRecord, TContext>; configuration: ExportOptions; controls: ExportControls; outputFormats?: readonly ExportFormat[]; documentTarget?: HTMLElement }>()
const emit = defineEmits<{ error: [error: Error] }>()
const open = defineModel<boolean>({ default: false })
const target = defineModel<HTMLElement>('target')
const host = ref<HTMLElement>()
const previewHost = ref<HTMLElement>()
const sheets = shallowRef<readonly { name: string; element: HTMLElement }[]>([])
const selected = ref(0)
const panelId = useId()
const tabButtons = ref<HTMLButtonElement[]>([])
const previewError = shallowRef<Error>()
let prepared: Awaited<ReturnType<typeof prepareDocument>> | undefined
let revision = 0
watch(host, value => { target.value = value })
watch([() => props.documentTarget, open], async () => {
  const current = ++revision
  if (!open.value || !props.documentTarget) return
  await nextTick()
  if (!previewHost.value) return
  previewError.value = undefined
  let result: Awaited<ReturnType<typeof prepareDocument>>
  try { result = await prepareDocument({ target: props.documentTarget, container: previewHost.value, styles: props.configuration.styles }) }
  catch (cause) { if (current === revision) { previewError.value = cause instanceof Error ? cause : new Error(String(cause)); emit('error', previewError.value) }; return }
  if (current !== revision) { result.dispose(); return }
  prepared?.dispose()
  prepared = result
  const frame = result.frame
  frame.style.cssText = 'width:100%;height:60vh;border:0;position:static;visibility:visible'
  frame.removeAttribute('aria-hidden')
  frame.title = 'Pratinjau ekspor'
  sheets.value = Array.from(result.target.querySelectorAll<HTMLElement>('[data-xlsx-sheet]')).map(element => ({ name: element.dataset.xlsxSheet ?? 'Sheet', element }))
  selected.value = 0
  showSheet(0)
}, { flush: 'post' })
function showSheet(index: number) {
  selected.value = index
  sheets.value.forEach((sheet, i) => { sheet.element.hidden = i !== index })
}
function navigateSheets(event: KeyboardEvent) {
  let next: number
  if (event.key === 'ArrowRight') next = (selected.value + 1) % sheets.value.length
  else if (event.key === 'ArrowLeft') next = (selected.value - 1 + sheets.value.length) % sheets.value.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = sheets.value.length - 1
  else return
  event.preventDefault()
  showSheet(next)
  tabButtons.value[next]?.focus()
}
onBeforeUnmount(() => { revision++; prepared?.dispose() })
</script>
<template>
  <div style="position:fixed;left:-100000px;top:0;width:1000px;pointer-events:none" aria-hidden="true">
    <div v-if="snapshot" ref="host" class="loom-export-document">
      <component :is="configuration.component" v-if="configuration.component" v-bind="snapshot" :config="snapshot.config" />
      <ExportBody v-else :snapshot="snapshot" />
    </div>
  </div>
  <Dialog v-model="open" class="max-w-6xl" close-on-outside-click close-on-escape>
    <template #title>Pratinjau ekspor</template>
    <template #description>{{ snapshot?.document.title ?? 'Dokumen ekspor' }}</template>
    <template #content>
      <div v-if="sheets.length > 1" role="tablist" aria-label="Lembar kerja" class="flex gap-2">
        <button v-for="(sheet, index) in sheets" :id="`${panelId}-tab-${index}`" ref="tabButtons" :key="index" type="button" role="tab" :tabindex="selected === index ? 0 : -1" :aria-controls="panelId" :aria-selected="selected === index" class="rounded px-3 py-2" :class="selected === index ? 'bg-surface-container-high font-semibold' : ''" @keydown="navigateSheets" @click="showSheet(index)">{{ sheet.name }}</button>
      </div>
      <div :id="panelId" ref="previewHost" role="tabpanel" :aria-labelledby="sheets.length > 1 ? `${panelId}-tab-${selected}` : undefined" />
      <p v-if="previewError" role="alert">{{ previewError.message }}</p>
      <p v-if="controls.error" role="alert">{{ controls.error.message }}</p>
    </template>
    <template #footer>
      <Button v-if="controls.formats.includes('pdf') && (!outputFormats || outputFormats.includes('pdf'))" variant="outlined" :disabled="controls.disabled" @click="controls.printPdf">Cetak / Simpan PDF</Button>
      <Button v-if="controls.formats.includes('xlsx') && (!outputFormats || outputFormats.includes('xlsx'))" :disabled="controls.disabled" @click="controls.downloadXlsx">Unduh Excel</Button>
    </template>
  </Dialog>
</template>
