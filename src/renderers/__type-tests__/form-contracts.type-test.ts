/**
 * Compile-time cases for component-derived form renderer props.
 * Type-checked by the framework `type-check`; excluded from vitest by filename.
 *
 * These cases run before the implementation. The negative cases use
 * `@ts-expect-error` and must stay unused until Step 2 threads the
 * component types through the authoring paths.
 */
import type { FieldDefinition } from '../../contracts/fields'
import type { FormRendererProps } from '../formContracts'

// Built-in renderer: correct declared prop passes.
const fileOk: FormRendererProps<'file'> = { accept: ['application/pdf'], extra: true }
void fileOk

// Built-in renderer: wrong declared prop type fails (inline literal).
const fileBadInline: FormRendererProps<'file'> = {
  // @ts-expect-error FileInput.accept is string[], not string
  accept: 'application/pdf',
}
void fileBadInline

// Built-in renderer: wrong declared prop type fails (named variable).
const wrongAccept = 'application/pdf'
const fileBadVariable: FormRendererProps<'file'> = {
  // @ts-expect-error FileInput.accept is string[], not string
  accept: wrongAccept,
}
void fileBadVariable

// Built-in renderer: wrong declared prop type fails (retained object spread).
const wrongSpread = { accept: 'application/pdf' as string }
const fileBadSpread: FormRendererProps<'file'> = {
  ...wrongSpread,
  // @ts-expect-error spread keeps the wrong string type for accept
  accept: wrongSpread.accept,
}
void fileBadSpread

// Extra props stay open.
const fileExtra: FormRendererProps<'file'> = { accpet: ['application/pdf'] }
void fileExtra

// Required component props stay optional at authoring.
const lookupOpen: FormRendererProps<'lookup'> = {}
void lookupOpen

// Undeclared renderer keys fail.
const unknownRenderer: FormRendererProps<
  // @ts-expect-error renderer keys come from the component map
  'not-a-renderer'
> = {}
void unknownRenderer

// Number value inference stays intact beside the prop contract.
const numberField = {
  amount: { form: { renderer: 'number', props: { currency: 'USD' } } },
} satisfies Record<string, FieldDefinition<{ amount: number }, { amount: number }, unknown>>
void numberField
