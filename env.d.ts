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
  readonly VITE_GOOGLE_MAP_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type CRUDPermissions = {
  view: boolean
  lookup: boolean
  detail: boolean
  create: boolean
  update: boolean
  delete: boolean
}

type CreateConfig = import('./src/model-config').CreateConfig
type UpdateConfig = import('./src/model-config').UpdateConfig
type ListConfig = import('./src/model-config').ListConfig
type DetailConfig = import('./src/model-config').DetailConfig

type CRUDCreateProps = Partial<CreateConfig> & {
  onSuccess?: (formData: Record<string, any>, res: Record<string, any>) => void
}

type CRUDUpdateProps = Partial<UpdateConfig>
type CRUDListProps = Partial<ListConfig> & {
  filter?: Partial<CRUDCreateProps>
}
type CRUDDetailProps = Partial<DetailConfig>
type FrameworkInputConfig = import('./src/model-config').InputConfig
