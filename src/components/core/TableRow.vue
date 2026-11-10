<script lang="ts">
import { Comment, Fragment, Text, cloneVNode, defineComponent, h, inject, isVNode, type VNode } from 'vue'
import TableCell from './TableCell.vue'
import { tableFooterOwnerKey, useTableComposition } from './tableComposition'

function cellsIn(content: unknown): VNode[] {
  if (Array.isArray(content)) return content.flatMap(cellsIn)
  if (!isVNode(content)) {
    if (content == null || content === false || (typeof content === 'string' && !content.trim())) return []
    throw new Error('[loom][TABLE_COMPOSITION_INVALID] TableRow accepts TableCell children only.')
  }
  if (content.type === Comment || (content.type === Text && typeof content.children === 'string' && !content.children.trim())) return []
  if (content.type === Fragment) return cellsIn(content.children)
  if (content.type !== TableCell) throw new Error('[loom][TABLE_COMPOSITION_INVALID] TableRow accepts TableCell children only.')
  return [content]
}

export default defineComponent({
  name: 'TableRow',
  props: { emphasis: Boolean },
  setup(props, { slots }) {
    const layout = useTableComposition()
    const ownerKey = inject(tableFooterOwnerKey, undefined)
    return () => {
      const declarations = cellsIn(slots.default?.())
      if (!declarations.length) return null
      const cells = new Map<string, VNode>()
      let fullWidth: VNode | undefined
      for (const cell of declarations) {
        const column: unknown = cell.props?.column
        const span: unknown = cell.props?.span
        if (span === 'all' && column === undefined) {
          if (declarations.length !== 1) throw new Error('[loom][TABLE_COMPOSITION_INVALID] A span="all" cell must be the only cell in its row.')
          fullWidth = cell
          break
        }
        if (span !== undefined || typeof column !== 'string' || !layout.value.columns.some((entry) => entry.key === column)) {
          throw new Error(`[loom][TABLE_COMPOSITION_INVALID] Unknown table column "${String(column)}".`)
        }
        if (cells.has(column)) throw new Error(`[loom][TABLE_COMPOSITION_INVALID] Duplicate table column "${column}".`)
        cells.set(column, cell)
      }
      const children = fullWidth
        ? [fullWidth]
        : [
            ...(layout.value.prefix ? [h('td', { key: 'structure:prefix' })] : []),
            ...layout.value.visibleColumns.map((column) => {
              const cell = cells.get(column.key)
              const key = `column:${column.key}`
              if (cell) return cloneVNode(cell, { key })
              return h('td', { key, class: ['px-4 py-3.5', column.class], style: { textAlign: column.align } })
            }),
            ...(layout.value.actions ? [h('td', { key: 'structure:actions' })] : []),
          ]
      return h('tr', { 'data-tree-footer-key': ownerKey, class: props.emphasis ? 'font-semibold' : undefined }, children)
    }
  },
})
</script>
