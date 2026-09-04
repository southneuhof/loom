<script setup lang="ts">
import { ref } from 'vue'
import html2pdf from 'html2pdf.js'

const props = defineProps({
  documentTitle: {
    type: String,
    default: 'document',
  },
  // pageStyle prop might not be directly applicable with html2pdf.js in the same way.
  // html2pdf.js captures styles applied to the element.
  // For specific PDF styling (margins, page breaks), html2pdf.js options are used.
  pageStyle: String,
  hidePrintView: {
    type: Boolean,
    default: false, // This prop might still be useful to hide the source element if desired
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
  // Create a download link and trigger download
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Clean up
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
  let originalDisplay: string = ''
  let originalStyles = {
    position: '',
    visibility: '',
    overflow: '',
    display: '',
    zIndex: '',
  }
  if (!printableRef.value) {
    console.error('Printable content not found.')
    emit('error', 'Printable content not found.')
    return
  }

  const element = printableRef.value
  const filename = `${props.documentTitle}.pdf`

  // Get the actual dimensions of the element including padding and borders
  const rect = element.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  // Reduce height slightly to prevent empty second page (subtract 10px or ~0.1in)
  const heightReduction = 0 // pixels
  const height = Math.max(1, Math.ceil(rect.height - heightReduction))
  console.log('Element dimensions:', { width, height, originalHeight: rect.height })

  // Calculate dimensions in inches (jsPDF uses 72 DPI by default)
  const dpi = 96 // Standard screen DPI
  const widthIn = width / dpi
  const heightIn = height / dpi

  const defaultOptions = {
    margin: [0.0, 0.25],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2, // Set scale to 1 to prevent additional scaling
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
        // Ensure the cloned document has the correct viewport
        const viewport = clonedDoc.defaultView
        if (viewport) {
          viewport.innerWidth = width
          viewport.outerWidth = width
        }
      },
    },
    jsPDF: {
      unit: 'in',
      format: [widthIn, heightIn], // Match html2canvas dimensions
      orientation: width > height ? 'landscape' : 'portrait',
    },
    // pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } // Example for page break control
  }

  const options = { ...defaultOptions, ...props.pdfOptions, filename }

  try {
    // Store original styles and ensure element is visible for capture
    originalStyles = {
      position: element.style.position,
      visibility: element.style.visibility,
      overflow: element.style.overflow,
      display: element.style.display,
      zIndex: element.style.zIndex,
    }

    // Activate PDF-specific styles

    // Make the element visible and properly sized for capture
    // if (props.hidePrintView) {
    //   element.style.position = 'absolute';
    //   element.style.visibility = 'hidden';
    //   element.style.overflow = 'visible';
    //   element.style.display = 'block';
    //   element.style.zIndex = '-1000';
    //   // Force a reflow to ensure dimensions are calculated
    //   element.offsetHeight;
    // }

    const pdfBlob = await html2pdf().from(element).set(options).outputPdf('blob')

    // Restore original styles and deactivate PDF-specific styles
    // if (props.hidePrintView) {
    //   Object.assign(element.style, originalStyles);
    // }
    deactivateCSSForPDF()

    if (props.onPDFReady) {
      props.onPDFReady(pdfBlob, filename)
    } else {
      downloadPDF(pdfBlob, filename)
    }

    // Emit event with the generated PDF data
    emit('pdfGenerated', { blob: pdfBlob, filename: filename })
  } catch (error) {
    console.error('Error generating PDF:', error)
    emit('error', error)
    // Restore display and deactivate PDF styles if an error occurred
    // if (props.hidePrintView) {
    //   Object.assign(element.style, originalStyles);
    // }
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
  /* z-index: -1000; */
  transform: translateY(-1000px);
  /* position: absolute !important; */
  /* left: -9999px !important; */
  /* top: -9999px !important; */
}
</style>
