import type { RowReorderPayload } from '../../../contracts'
import type { TableInputRow } from './tableInput.types'

export function appendTableInputRow<TRow extends TableInputRow>(rows: readonly TRow[], row: TRow): TRow[] {
  return [...rows, row]
}

export function replaceTableInputRow<TRow extends TableInputRow>(rows: readonly TRow[], index: number, row: TRow): TRow[] {
  return rows.map((current, currentIndex) => currentIndex === index ? row : current)
}

export function removeTableInputRow<TRow extends TableInputRow>(rows: readonly TRow[], index: number): TRow[] {
  return rows.filter((_, currentIndex) => currentIndex !== index)
}

export function reorderedTableInputRows<TRow extends TableInputRow>(payload: RowReorderPayload<TRow>): TRow[] {
  return [...payload.rows]
}
