<script setup lang="ts">
import { ref } from 'vue'
import html2pdf from 'html2pdf.js'

const props = defineProps({
  documentTitle: {
    type: String,
    default: 'document',
  },
  pageStyle: String,
  hidePrintView: {
    type: Boolean,
    default: false,
  },
  pdfOptions: {
    type: Object,
    default: () => ({}),
  },
  onPDFReady: {
    type: Function,
  },
})

function downloadPDF(pdfBlob: Blob, filename: string) {
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

const activateCSSForPDF = () => document.body.classList.add('pdf')
const deactivateCSSForPDF = () => document.body.classList.remove('pdf')

const emit = defineEmits(['pdfGenerated', 'error'])

const printableRef = ref<HTMLElement | null>(null)

const handlePrint = async () => {
  activateCSSForPDF()
  if (!printableRef.value) {
    console.error('Printable content not found.')
    emit('error', 'Printable content not found.')
    return
  }

  const element = printableRef.value
  const filename = `${props.documentTitle}.pdf`

  const rect = element.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.max(1, Math.ceil(rect.height))

  // Calculate dimensions in inches (jsPDF uses 72 DPI by default)
  const dpi = 96 // Standard screen DPI
  const widthIn = width / dpi
  const heightIn = height / dpi

  const defaultOptions = {
    margin: [0.0, 0.25],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: true,
      width: width,
      height: height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      allowTaint: true, // Allow cross-origin images
      onclone: (clonedDoc: Document) => {
        const viewport = clonedDoc.defaultView
        if (viewport) {
          viewport.innerWidth = width
          viewport.outerWidth = width
        }
      },
    },
    jsPDF: {
      unit: 'in',
      format: [widthIn, heightIn],
      orientation: width > height ? 'landscape' : 'portrait',
    },
  }

  const options = { ...defaultOptions, ...props.pdfOptions, filename }

  try {
    const pdfBlob = await html2pdf().from(element).set(options).outputPdf('blob')

    deactivateCSSForPDF()

    if (props.onPDFReady) {
      props.onPDFReady(pdfBlob, filename)
    } else {
      downloadPDF(pdfBlob, filename)
    }

    emit('pdfGenerated', { blob: pdfBlob, filename: filename })
  } catch (error) {
    console.error('Error generating PDF:', error)
    emit('error', error)
    deactivateCSSForPDF()
  }
}

defineExpose({ handlePrint })
</script>

<template>
  <slot name="trigger" v-bind="{ handlePrint }" />
  <div ref="printableRef" :class="hidePrintView ? 'hidden-for-print' : ''">
    <slot name="content" />
  </div>
</template>

<style scoped>
.hidden-for-print {
  transform: translateY(-1000px);
}
</style>
