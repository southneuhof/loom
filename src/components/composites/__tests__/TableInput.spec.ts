import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import TableInput from '../form-inputs/TableInput.vue'
import {
  appendTableInputRow,
  removeTableInputRow,
  reorderedTableInputRows,
  replaceTableInputRow,
} from '../form-inputs/tableInput.model'
import { mountCore } from '../../core/__tests__/harness'

const first = { id: 'one', name: 'First' }
const second = { id: 'two', name: 'Second' }
const fields = {
  id: { label: 'ID', form: { renderer: 'text' } },
  name: { label: 'Name', form: { renderer: 'text' } },
}

describe('TableInput row state', () => {
  it('creates rows immutably', () => {
    const rows = [first]
    const next = appendTableInputRow(rows, second)

    expect(next).toEqual([first, second])
    expect(next).not.toBe(rows)
    expect(rows).toEqual([first])
  })

  it('replaces the complete edited row immutably', () => {
    const rows = [first, second]
    const replacement = { id: 'one', name: 'Replacement' }
    const next = replaceTableInputRow(rows, 0, replacement)

    expect(next).toEqual([replacement, second])
    expect(next[0]).toBe(replacement)
    expect(next).not.toBe(rows)
  })

  it('deletes only the selected row after confirmation calls the operation', () => {
    const rows = [first, second]
    expect(removeTableInputRow(rows, 0)).toEqual([second])
    expect(rows).toEqual([first, second])
  })

  it('adopts a reordered core Table payload immutably', () => {
    const ordered = [second, first]
    const next = reorderedTableInputRows({
      rows: ordered,
      oldIndex: 1,
      newIndex: 0,
      moved: second,
      query: {},
    })

    expect(next).toEqual(ordered)
    expect(next).not.toBe(ordered)
  })
})

describe('TableInput surface', () => {
  it('renders rows and mutation controls through core components', () => {
    const view = mountCore(TableInput, { fields, modelValue: [first, second] })

    expect(view.text()).toContain('First')
    expect(view.text()).toContain('Second')
    expect(view.text()).toContain('Tambah')
    expect(view.all('[aria-label="Edit row"]')).toHaveLength(2)
    expect(view.all('[aria-label="Delete row"]')).toHaveLength(2)
    expect(view.all('[aria-label="Row actions"]')).toHaveLength(2)
    expect(view.all('[aria-label="Row actions"]')[0].className).toContain('justify-end')
    expect(view.all('[aria-label="Row actions"]')[0].className).toContain('gap-1')
    expect(view.text()).not.toContain('DataCloneError')
    view.unmount()
  })

  it('hides mutation controls and reordering while disabled', () => {
    const view = mountCore(TableInput, {
      fields,
      modelValue: [first],
      disabled: true,
      reorderable: true,
      rowKey: 'id',
    })

    expect(view.text()).not.toContain('Tambah')
    expect(view.find('[aria-label="Edit row"]')).toBeNull()
    expect(view.find('[aria-label="Delete row"]')).toBeNull()
    expect(view.find('.sortable-chosen')).toBeNull()
    view.unmount()
  })

  it('requires rowKey when reordering is enabled', () => {
    expect(() => mountCore(TableInput, { fields, modelValue: [first], reorderable: true })).toThrow(
      '[loom] TableInput reorderable mode requires rowKey.',
    )
  })

  it('preserves create-button and table customization slots', () => {
    const view = mountCore(
      TableInput,
      { fields, modelValue: [first] },
      {
        slots: {
          'create-button': () => h('span', { 'data-custom-create': '' }, 'Custom create'),
          table: ({ data }) => h('div', { 'data-custom-table': '' }, `${(data as unknown[]).length} custom row`),
        },
      },
    )

    expect(view.find('[data-custom-create]')?.textContent).toBe('Custom create')
    expect(view.find('[data-custom-table]')?.textContent).toBe('1 custom row')
    view.unmount()
  })
})

describe('TableInput core migration boundary', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/composites/form-inputs/TableInput.vue'), 'utf8')

  it('composes core Table with core-native DialogForm', () => {
    expect(source).toContain("../../core/Table.vue")
    expect(source).toContain("../DialogForm.vue")
    expect(source).not.toContain("../../core/Form.vue")
    expect(source).not.toContain("../../base/Dialog.vue")
    expect(source).not.toContain('../Table.vue')
    expect(source).not.toMatch(/keyManager|fieldsAlias|draggable/)
    expect(source).not.toContain('description=')
    expect(source).not.toContain('submit-label=')
    expect(source).not.toContain('label || title')
  })

  it('preserves customization slots and core row action payloads', () => {
    expect(source).toContain("name=\"create-button\"")
    expect(source).toContain("name=\"table\"")
    expect(source).toContain('#row-actions="{ record, index }"')
  })

  it('commits only through validated Form submissions', () => {
    expect(source).toContain(':submit="createRow"')
    expect(source).toContain(':submit="(payload) => replaceRow(index, payload)"')
    expect(source).toContain('title="Tambah baris"')
    expect(source).toContain('title="Ubah baris"')
    expect(source).not.toContain('setOpen(false)')
    expect(source).not.toMatch(/@input=.*createRow|@click=.*createRow/)
  })

  it('requires rowKey for reorderable mode and suppresses mutation controls while disabled', () => {
    expect(source).toContain('TableInput reorderable mode requires rowKey')
    expect(source).toContain(':reorderable="reorderable && !disabled"')
    expect(source).toContain('v-if="!disabled"')
  })

  it('matches ListView standard row action styling', () => {
    expect(source).toContain('class="flex items-center justify-end gap-1" aria-label="Row actions"')
    expect(source).toContain('kind="icon" variant="standard" aria-label="Edit row"')
    expect(source).toContain('kind="icon" color="error" variant="standard" aria-label="Delete row"')
    expect(source).not.toMatch(/color="warning" variant="tonal" aria-label="Edit row"/)
    expect(source).not.toMatch(/color="error" variant="tonal" aria-label="Delete row"/)
  })
})
