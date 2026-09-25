import type { FormRendererModelValue, FormRendererNeedsProps, FormRendererProps } from '../formContracts'
import type TextInput from '../../components/inputs/TextInput.vue'
import type PasswordInput from '../../components/inputs/PasswordInput.vue'
import type {
  TextInputConstraint,
  TextInputDataAttributes,
  TextInputModelValue,
  TextInputNativeAttributes,
} from '../../components/inputs/textInput.types'
import type { AssetValue } from '../../assets/contracts'
import type { OptionLoad } from '../../contracts/load'
import { defineForm } from '../../forms/defineForm'
import { z } from 'zod'

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
  ? (<T>() => T extends TRight ? 1 : 2) extends (<T>() => T extends TLeft ? 1 : 2) ? true : false
  : false
type Assert<T extends true> = T
type TextInputPublicProps = InstanceType<typeof TextInput>['$props']
type PasswordInputPublicProps = InstanceType<typeof PasswordInput>['$props']

type TextPropAndEventModelAgree = Assert<Equal<FormRendererModelValue<'text'>, string | number>>
type DatePropAndEventModelAgree = Assert<Equal<FormRendererModelValue<'date'>, string | null>>
type ModelIsRequiredForFormInputs = Assert<Equal<FormRendererModelValue<'separator'>, never>>
type TablePropsStayRequired = Assert<Equal<FormRendererNeedsProps<'table'>, true>>
type DirectAndManagedNativePropsAgree = Assert<Equal<
  Pick<TextInputPublicProps, keyof TextInputNativeAttributes>,
  Pick<FormRendererProps<'text'>, keyof TextInputNativeAttributes>
>>
type DirectAndManagedPasswordNativePropsAgree = Assert<Equal<
  Pick<PasswordInputPublicProps, keyof TextInputNativeAttributes>,
  Pick<FormRendererProps<'password'>, keyof TextInputNativeAttributes>
>>
type NumericTextCanBeUnset = Assert<Equal<TextInputModelValue<readonly ['number']>, number | undefined>>

const fileOk: FormRendererProps<'file'> = { accept: ['application/pdf'] }
const wrongAccept = 'application/pdf'

const fileBadInline: FormRendererProps<'file'> = {
  // @ts-expect-error FileInput.accept is a string array.
  accept: 'application/pdf',
}

const fileBadVariable: FormRendererProps<'file'> = {
  // @ts-expect-error FileInput.accept is a string array.
  accept: wrongAccept,
}
const tableProps: FormRendererProps<'table'> = {
  table: {
    schema: z.object({ id: z.string() }),
    columns: { id: { label: 'ID' } },
  },
}

const schema = z.object({ name: z.string() })
const missingRenderer = defineForm({
  schema: z.object({ status: z.string() }),
  // @ts-expect-error Every authored form field needs an explicit renderer.
  fields: { status: {} },
})
const dataProps = {
  'data-field-kind': 'email',
  'data-attempt': 2,
  'data-cleared': null,
} satisfies TextInputDataAttributes
const managedDataProps: Pick<FormRendererProps<'text'>, keyof TextInputDataAttributes> = dataProps
const dataPropsForm = defineForm({ schema, fields: { name: { renderer: 'text', props: managedDataProps } } })
const directReadonlyProps = { readonly: false } satisfies Pick<TextInputPublicProps, 'readonly'>
const managedReadonlyProps: Pick<FormRendererProps<'text'>, 'readonly'> = directReadonlyProps
const readonlyForm = defineForm({ schema, fields: { name: { renderer: 'text', props: managedReadonlyProps } } })
const directPasswordReadonlyProps = { readonly: false } satisfies Pick<PasswordInputPublicProps, 'readonly'>
const managedPasswordReadonlyProps: Pick<FormRendererProps<'password'>, 'readonly'> = directPasswordReadonlyProps
const passwordReadonlyForm = defineForm({ schema, fields: { name: { renderer: 'password', props: managedPasswordReadonlyProps } } })
const directStringReadonly = {
  // @ts-expect-error A native readonly attribute takes a boolean.
  readonly: 'false',
} satisfies Pick<TextInputPublicProps, 'readonly'>
const managedStringReadonly = {
  // @ts-expect-error Form uses the TextInput readonly contract.
  readonly: 'false',
} satisfies Pick<FormRendererProps<'text'>, 'readonly'>
const directPasswordStringReadonly = {
  // @ts-expect-error PasswordInput uses the native boolean readonly contract.
  readonly: 'false',
} satisfies Pick<PasswordInputPublicProps, 'readonly'>
const managedPasswordStringReadonly = {
  // @ts-expect-error Form uses the PasswordInput readonly contract.
  readonly: 'false',
} satisfies Pick<FormRendererProps<'password'>, 'readonly'>
const correctProps = { placeholder: 'Name' } satisfies FormRendererProps<'text'>
const spreadTextProps = { ...correctProps, name: 'owner' } satisfies FormRendererProps<'text'>
const optionalTextProps: { placeholder?: string } = {}
const nativeTextProps = {
  name: 'owner',
  autocomplete: 'email',
  inputmode: 'email',
  maxlength: 120,
  minlength: 2,
  pattern: '[^@]+@[^@]+',
  readonly: false,
  title: 'Email address',
  tabindex: 0,
  'aria-label': 'Email address',
  'aria-describedby': 'email-hint',
  'data-field-kind': 'email',
  'data-attempt': 2,
  'data-readonly': false,
  'data-cleared': null,
  onInput: (event: Event) => event.preventDefault(),
} satisfies FormRendererProps<'text'>
const textForm = defineForm({ schema, fields: { name: { renderer: 'text', props: correctProps } } })
const nativeTextForm = defineForm({ schema, fields: { name: { renderer: 'text', props: nativeTextProps } } })
const spreadTextForm = defineForm({ schema, fields: { name: { renderer: 'text', props: spreadTextProps } } })
const optionalTextForm = defineForm({ schema, fields: { name: { renderer: 'text', props: optionalTextProps } } })
const numericTextForm = defineForm({
  schema: z.object({ amount: z.number() }),
  fields: { amount: { renderer: 'text', props: { constraint: ['number'] as const } } },
})
const textModeRejectsNumber = defineForm({
  schema: z.object({ amount: z.number() }),
  // @ts-expect-error The default text model emits strings.
  fields: { amount: { renderer: 'text' } },
})
const numericModeRejectsString = defineForm({
  schema,
  // @ts-expect-error A numeric constraint emits numbers.
  fields: { name: { renderer: 'text', props: { constraint: ['integer'] as const } } },
})
const broadConstraints: readonly TextInputConstraint[] = ['number', 'text']
const broadModeRejectsString = defineForm({
  schema,
  // @ts-expect-error The broad model can emit a number.
  fields: { name: { renderer: 'text', props: { constraint: broadConstraints } } },
})
const numericSelection = defineForm({
  schema: z.object({ ownerId: z.number() }),
  fields: { ownerId: { renderer: 'select', props: { data: [{ id: 1, name: 'Owner' }] } } },
})
const invalidNumericSelection = defineForm({
  schema: z.object({ ownerId: z.string() }),
  // @ts-expect-error The selected key is numeric.
  fields: { ownerId: { renderer: 'select', props: { data: [{ id: 1, name: 'Owner' }] } } },
})
const multiSelection = defineForm({
  schema: z.object({ owners: z.array(z.object({ id: z.string(), name: z.string() })) }),
  fields: { owners: { renderer: 'select', props: { data: [{ id: '1', name: 'Owner' }], multi: true } } },
})
const invalidMultiSelection = defineForm({
  schema: z.object({ owner: z.string() }),
  // @ts-expect-error Multi selection emits an array of records.
  fields: { owner: { renderer: 'select', props: { data: [{ id: '1', name: 'Owner' }], multi: true } } },
})
const radioSelection = defineForm({
  schema: z.object({ status: z.string() }),
  fields: { status: { renderer: 'radio', props: { data: [{ id: 'active', name: 'Active' }] } } },
})
const invalidRadioSelection = defineForm({
  schema: z.object({ status: z.number() }),
  // @ts-expect-error RadioGroupInput emits the selected string key.
  fields: { status: { renderer: 'radio', props: { data: [{ id: 'active', name: 'Active' }] } } },
})
type RoleOption = { id: string; name: string }
const loadRoleOptions: OptionLoad<RoleOption> = async () => ({ data: [{ id: 'owner', name: 'Owner' }] })
const loadedCheckboxSelection = defineForm({
  schema: z.object({ roles: z.array(z.object({ id: z.string() })) }),
  fields: { roles: { renderer: 'checkbox-group', props: { load: loadRoleOptions } } },
})
const invalidLoadedRadioSelection = defineForm({
  schema: z.object({ roleId: z.number() }),
  // @ts-expect-error RadioGroupInput emits the loaded option's string id.
  fields: { roleId: { renderer: 'radio', props: { load: loadRoleOptions } } },
})
const textareaForm = defineForm({
  schema: z.object({ description: z.string() }),
  fields: { description: { renderer: 'textarea' } },
})
const numericTextareaForm = defineForm({
  schema: z.object({ amount: z.number() }),
  fields: { amount: { renderer: 'textarea', props: { constraint: ['number'] as const } } },
})
const invalidNumericTextarea = defineForm({
  schema: z.object({ description: z.string() }),
  // @ts-expect-error A single number constraint emits numbers.
  fields: { description: { renderer: 'textarea', props: { constraint: ['number'] as const } } },
})
const broadTextareaConstraint: readonly ('number' | 'text')[] = ['number', 'text']
const invalidBroadTextarea = defineForm({
  schema: z.object({ description: z.string() }),
  // @ts-expect-error A broad textarea constraint may emit a number.
  fields: { description: { renderer: 'textarea', props: { constraint: broadTextareaConstraint } } },
})
const asset: AssetValue = { kind: 'file', id: 'uploads/file.pdf', url: 'https://assets.test/file.pdf', name: 'file.pdf' }
const singleAssetForm = defineForm({
  schema: z.object({ file: z.custom<AssetValue | null>() }),
  fields: { file: { renderer: 'file' } },
})
const multiAssetForm = defineForm({
  schema: z.object({ files: z.array(z.custom<AssetValue>()) }),
  fields: { files: { renderer: 'file', props: { multi: true } } },
})
const invalidMultiAssetForm = defineForm({
  schema: z.object({ file: z.custom<AssetValue | null>() }),
  // @ts-expect-error Multi FileInput emits an array of assets.
  fields: { file: { renderer: 'file', props: { multi: true } } },
})
const invalidSingleAssetForm = defineForm({
  schema: z.object({ files: z.array(z.custom<AssetValue>()) }),
  // @ts-expect-error Single FileInput emits one asset or null.
  fields: { files: { renderer: 'file' } },
})
const singleImageForm = defineForm({
  schema: z.object({ photo: z.custom<AssetValue | null>() }),
  fields: { photo: { renderer: 'image' } },
})
const multiImageForm = defineForm({
  schema: z.object({ photos: z.array(z.custom<AssetValue>()) }),
  fields: { photos: { renderer: 'image', props: { multi: true } } },
})
const misspelledProp = { placehoder: 'Name' }
const spreadMisspelling = { ...correctProps, ...misspelledProp }

const inlineMisspelling = defineForm({
  schema,
  // @ts-expect-error TextInput does not publish the misspelled prop.
  fields: { name: { renderer: 'text', props: { placehoder: 'Name' } } },
})

const variableMisspelling = defineForm({
  schema,
  // @ts-expect-error A variable does not make an unknown prop valid.
  fields: { name: { renderer: 'text', props: misspelledProp } },
})

const spreadMisspellingForm = defineForm({
  schema,
  // @ts-expect-error A spread does not make an unknown prop valid.
  fields: { name: { renderer: 'text', props: spreadMisspelling } },
})
type TextPropsUnion = { placeholder: string } | { placehoder: string }
declare const unionTextProps: TextPropsUnion
const unionMisspellingForm = defineForm({
  schema,
  // @ts-expect-error Every branch of a props union must use a published component prop.
  fields: { name: { renderer: 'text', props: unionTextProps } },
})
const selectRejectsTextOnlyAttribute = defineForm({
  schema,
  // @ts-expect-error SelectInput does not publish text-input native attributes.
  fields: { name: { renderer: 'select', props: { data: [{ id: 'owner', name: 'Owner' }], autocomplete: 'email' } } },
})

const unknownRendererProps: FormRendererProps<
  // @ts-expect-error Renderer keys come from the component map.
  'not-a-renderer'
> = {}

void [fileOk, fileBadInline, fileBadVariable, tableProps, missingRenderer, dataProps, managedDataProps, dataPropsForm, directReadonlyProps, managedReadonlyProps, readonlyForm, directPasswordReadonlyProps, managedPasswordReadonlyProps, passwordReadonlyForm, directStringReadonly, managedStringReadonly, directPasswordStringReadonly, managedPasswordStringReadonly, textForm, nativeTextForm, spreadTextForm, optionalTextForm, numericTextForm, textModeRejectsNumber, numericModeRejectsString, broadModeRejectsString, numericSelection, invalidNumericSelection, multiSelection, invalidMultiSelection, radioSelection, invalidRadioSelection, loadRoleOptions, loadedCheckboxSelection, invalidLoadedRadioSelection, textareaForm, numericTextareaForm, invalidNumericTextarea, broadTextareaConstraint, invalidBroadTextarea, asset, singleAssetForm, multiAssetForm, invalidMultiAssetForm, invalidSingleAssetForm, singleImageForm, multiImageForm, inlineMisspelling, variableMisspelling, spreadMisspellingForm, unionMisspellingForm, selectRejectsTextOnlyAttribute, unknownRendererProps]
