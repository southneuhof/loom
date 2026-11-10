import { inject, type ComputedRef, type InjectionKey } from 'vue'

export interface TableCompositionColumn {
  key: string
  class?: string
  align?: 'start' | 'center' | 'end'
}

export interface TableCompositionLayout {
  columns: readonly TableCompositionColumn[]
  visibleColumns: readonly TableCompositionColumn[]
  prefix: boolean
  actions: boolean
}

export const tableCompositionKey: InjectionKey<ComputedRef<TableCompositionLayout>> = Symbol('table-composition')
export const tableFooterOwnerKey: InjectionKey<string | undefined> = Symbol('table-footer-owner')

export function useTableComposition() {
  const layout = inject(tableCompositionKey)
  if (!layout) throw new Error('[loom][TABLE_COMPOSITION_INVALID] TableRow and TableCell require a Table or TreeTable.')
  return layout
}
