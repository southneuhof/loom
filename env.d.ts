declare module '*.css' {}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module 'html2pdf.js' {
  const html2pdf: any
  export default html2pdf
}

interface ImportMetaEnv {
  readonly GOOGLE_MAP_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png" {
  const url: string
  export default url
}
