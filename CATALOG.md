# Loom and web framework catalog

Generated from source by `node scripts/generate-framework-catalog.mjs`. Do not edit by hand.

## Views and core components

| Component | Models and props | Slots | Source |
|---|---|---|---|
| `ListView` | `title`, `description`, `actionLabels`, `filters`, `filterControls`, `bodyVariant`, `exportAccess`, `export`, `table`, `createRoute`, `detailRoute`, `updateRoute`, `can`, `deleteRecord`, `recordIdentity` | `row-actions-view`, `row-actions-edit`, `row-actions-delete`, `row-actions`, `header`, `column-dialog`, `export-action`, `toolbar`, `resource-action`, `create-action`, `filters`, `context`, `body`, `collection`, `[dynamic]`, `footer` | `packages/loom/src/components/views/ListView.vue` |
| `DetailView` | `detail`, `exportAccess`, `export`, `title`, `description`, `actionLabels`, `backTo`, `updateRoute`, `can`, `deleteRecord`, `recordIdentity`, `afterDeleteTo` | `header`, `title`, `description`, `export-action`, `edit-action`, `delete-action`, `controls`, `loading`, `error`, `empty`, `read-error`, `body`, `[dynamic]` | `packages/loom/src/components/views/DetailView.vue` |
| `FormView` | `form`, `title`, `description`, `backTo`, `defaultTo`, `completion`, `afterSubmit`, `successMessage` | `header`, `controls`, `saved`, `loading`, `load-error`, `body`, `[dynamic]`, `actions`, `footer` | `packages/loom/src/components/views/FormView.vue` |
| `PageHeader` | `title`, `description`, `backTo`, `backLabel` | `header`, `title`, `description`, `toolbar`, `controls`, `subbar` | `packages/loom/src/components/views/PageHeader.vue` |
| `Table` | `meta`, `searchParameters`, `resource`, `namespace`, `query`, `querySchema`, `pagination`, `pageSizeOptions`, `defaultPageSize`, `reorderable`, `schema`, `columns`, `labels`, `context`, `density`, `sourceGuard`, `minColumnWidth`, `maxColumnWidth`, `visibleColumns`, `columnSizing`, `rowKey`, `data`, `load` | `collection`, `[dynamic]` | `packages/loom/src/components/core/Table.vue` |
| `TreeTable` | `meta`, `searchParameters`, `resource`, `namespace`, `query`, `querySchema`, `pagination`, `pageSizeOptions`, `defaultPageSize`, `schema`, `columns`, `labels`, `context`, `density`, `sourceGuard`, `minColumnWidth`, `maxColumnWidth`, `visibleColumns`, `columnSizing`, `data`, `load`, `rowKey`, `children`, `treeColumn`, `expandedKeys`, `defaultExpandedKeys` | `collection`, `[dynamic]` | `packages/loom/src/components/core/TreeTable.vue` |
| `Detail` | `schema`, `fields`, `sections`, `labels`, `context`, `sourceGuard`, `recordIdentity`, `id`, `searchParameters`, `resource`, `namespace`, `data`, `load` | `loading`, `error`, `empty`, `read-error`, `[dynamic]` | `packages/loom/src/components/core/Detail.vue` |
| `Form` | `schema`, `fields`, `sections`, `labels`, `validators`, `modelValue`, `initialData`, `load`, `id`, `resource`, `namespace`, `searchParameters`, `context`, `normalizeError`, `completeOnSubmit`, `disabled`, `submitLabel`, `submittingLabel`, `submit`, `name`, `target` | `[dynamic]` | `packages/loom/src/components/core/Form.vue` |

## Base and composite components

| Component | Models and props | Slots | Source |
|---|---|---|---|
| `Accordion` | `isOpen`, `color`, `unmount` | `preview`, `content` | `packages/loom/src/components/base/Accordion.vue` |
| `Alert` | `type`, `defaultIcon` | `default` | `packages/loom/src/components/base/Alert.vue` |
| `Button` | `kind`, `variant`, `color`, `disabled`, `softDisabled`, `href`, `target`, `type`, `name`, `value`, `form`, `trailingIcon`, `toggle`, `selected`, `ariaLabel`, `ariaLabelSelected`, `menuAriaLabel` | `icon`, `default`, `trailing-icon`, `menu`, `selected-icon` | `packages/loom/src/components/base/Button.vue` |
| `ContextMenu` | `items`, `disabled`, `openOnClick`, `contentClass` | `trigger`, `content` | `packages/loom/src/components/base/ContextMenu.vue` |
| `Card` | `variant`, `color`, `containerRole`, `disabled` | `header`, `default`, `footer` | `packages/loom/src/components/base/Card.vue` |
| `Chip` | `color`, `variant`, `interactive` | `default` | `packages/loom/src/components/base/Chip.vue` |
| `Dialog` | `v-model`, `closeOnOutsideClick`, `closeOnEscape`, `disabled` | `trigger`, `title`, `description`, `content`, `footer` | `packages/loom/src/components/base/Dialog.vue` |
| `Disclosure` | `title`, `description`, `open` | `default` | `packages/loom/src/components/base/Disclosure.vue` |
| `Drawer` | `v-model`, `title`, `description`, `side`, `closeOnOutsideClick`, `closeOnEscape`, `disabled` | `trigger`, `title`, `description`, `content`, `footer` | `packages/loom/src/components/base/Drawer.vue` |
| `Icon` | `fill`, `size`, `name` | - | `packages/loom/src/components/base/Icon.vue` |
| `ImagePreview` | `imageURL`, `thumbnailURL`, `asset`, `isOpen`, `square`, `disableControls` | `actions`, `image-thumbnail`, `no-image`, `trigger`, `image-detail`, `image-description` | `packages/loom/src/components/base/ImagePreview.vue` |
| `ImagePreviewMulti` | `images`, `assets`, `isOpen`, `disableControls` | `actions`, `no-image` | `packages/loom/src/components/base/ImagePreviewMulti.vue` |
| `ListItem` | `selected`, `disabled`, `href`, `target` | `leading`, `default`, `trailing` | `packages/loom/src/components/base/ListItem.vue` |
| `Menu` | `disabled`, `items` | `trigger` | `packages/loom/src/components/base/Menu.vue` |
| `Popover` | `v-model`, `matchWidth`, `anchor`, `align`, `alignOffset`, `sideOffset`, `side`, `disabled`, `contentClass` | `trigger`, `content` | `packages/loom/src/components/base/Popover.vue` |
| `Skeleton` | `color` | - | `packages/loom/src/components/base/Skeleton.vue` |
| `Spinner` | `color` | - | `packages/loom/src/components/base/Spinner.vue` |
| `Stars` | `value`, `outOf` | - | `packages/loom/src/components/base/Stars.vue` |
| `Timeline` | `data` | `node`, `header`, `content` | `packages/loom/src/components/base/Timeline.vue` |
| `Toast` | `type`, `defaultIcon` | `default` | `packages/loom/src/components/base/Toast.vue` |
| `Tooltip` | - | `content`, `trigger` | `packages/loom/src/components/base/Tooltip.vue` |
| `ChipFilter` | `v-model`, `items`, `selection` | - | `packages/loom/src/components/composites/ChipFilter.vue` |
| `ConfirmationDialog` | `title`, `message`, `actions`, `onConfirm`, `onCancel`, `onSuccess`, `onError`, `data`, `disabled` | `trigger`, `title`, `icon`, `description` | `packages/loom/src/components/composites/ConfirmationDialog.vue` |
| `DialogForm` | `schema`, `fields`, `sections`, `labels`, `validators`, `modelValue`, `initialData`, `load`, `id`, `resource`, `namespace`, `searchParameters`, `context`, `normalizeError`, `completeOnSubmit`, `disabled`, `submitLabel`, `submittingLabel`, `submit`, `name`, `target`, `open`, `title`, `description`, `closeOnSubmitted`, `beforeClose`, `cancelLabel` | `trigger`, `title`, `description`, `header`, `[dynamic]`, `actions`, `footer` | `packages/loom/src/components/composites/DialogForm.vue` |
| `DisclosureGroup` | `config` | `content` | `packages/loom/src/components/composites/DisclosureGroup.vue` |
| `IframePreviewDialog` | `url`, `title` | `trigger`, `title` | `packages/loom/src/components/composites/IframePreviewDialog.vue` |
| `Tabs` | `label`, `variant`, `orientation`, `items`, `modelValue`, `record` | - | `packages/loom/src/components/composites/Tabs.vue` |
| `LookupInput` | `v-model`, `table`, `context`, `loadDetail`, `searchParameters`, `namespace`, `view`, `multi`, `pick`, `placeholder`, `field`, `label`, `helperMessage`, `error`, `disabled`, `required`, `data`, `load` | `trigger` | `packages/loom/src/components/composites/form-inputs/LookupInput.vue` |
| `TableInput` | `v-model`, `mode`, `fields`, `createRow`, `addLabel`, `table`, `disabled`, `field`, `label`, `helperMessage`, `error`, `required`, `context`, `form`, `toDraft`, `reorderable`, `rowKey` | `[dynamic]`, `create-button`, `table` | `packages/loom/src/components/composites/form-inputs/TableInput.vue` |
| `LocationInput` | `v-model`, `mapProvider`, `operations`, `...commonProps` | - | `packages/loom/src/components/composites/form-inputs/LocationInput.vue` |
| `MultiLocationInput` | `v-model`, `mapProvider`, `operations`, `addLabel`, `emptyLabel`, `...commonProps` | - | `packages/loom/src/components/composites/form-inputs/MultiLocationInput.vue` |

## High-traffic component contracts

See each declaration for constraints on combinations of props.

### [ListView](src/components/views/ListView.vue)

- Props (`ListViewProps<TRecord, TQuery, TFilterInput, TContext>`) `title?: string`, `description?: string`, `actionLabels?: Partial<Record<'create' | 'view' | 'edit' | 'delete', string>>`, `filters?: ListFilters<TQuery, TFilterInput, TContext>`, `filterControls?: ListViewFilterControls`, `bodyVariant?: ListViewBodyVariant`, `exportAccess?: (record?: TRecord) => boolean`, `export?: ListExportConfiguration<TRecord, TQuery, TContext> | boolean`, `table: TableProps<TRecord, TQuery, TContext>`, `createRoute?: RouteTarget | false`, `detailRoute?: ((record: TRecord) => RouteTarget | undefined) | false`, `updateRoute?: ((record: TRecord) => RouteTarget | undefined) | false`, `can?: (operation: ResourceOperation, record?: TRecord) => boolean`, `deleteRecord?: (record: TRecord) => Promise<unknown>`, `recordIdentity?: (record: TRecord) => RecordIdentity`, `deleteRecord: (record: TRecord) => Promise<unknown>`, `recordIdentity: (record: TRecord) => RecordIdentity`, `deleteRecord?: undefined`, `recordIdentity?: never`
- Slots `cell:${string}: { value: unknown; record: TRecord; field: unknown; index: number }`, `collection: CollectionSlotProps<TRecord, TQuery> & { actions?: ListViewSlotActions<TRecord>; rowActions: typeof RowActions; exportControls: ExportControls }`, `row-actions-view: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: RouteTarget }`, `row-actions-edit: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: RouteTarget }`, `row-actions-delete: { record: TRecord; can?: ListViewActions<TRecord>["can"]; deleteRecord?: ListViewSlotActions<TRecord>["deleteRecord"]; deleteState: ListViewDeleteState }`, `create-action: { can?: ListViewActions<TRecord>["can"]; target: RouteTarget }`, `resource-action: { exportControls: ExportControls }`, `export-action: { exportControls: ExportControls }`, `header: { exportControls: ExportControls }`, `empty`, `filters: FilterSlotProps { draft, issues, validating, setValue, validate, reset, setError, errorFor, touched, touch, field }`, `context: ListViewContextSlotProps { draft, issues, validating, setValue, validate, reset, setError, errorFor, touched, touch, field, context, loading, error, query }`, `toolbar: { exportControls: ExportControls } & FilterSlotProps`, `body: { table: TableProps<TRecord, TQuery, TContext>; exportControls: ExportControls }`, `footer: { exportControls: ExportControls }`, `row-actions: { record: TRecord }`, `column-dialog: { columns, reset }`

### [DetailView](src/components/views/DetailView.vue)

- Props (`DetailViewProps<TRecord, TContext> & { detail: { schema: TSchema } }`) `detail: DetailProps<TRecord, TContext>`, `exportAccess?: (record?: TRecord) => boolean`, `export?: DetailExportConfiguration<TRecord, TContext> | boolean`, `title?: string`, `description?: string`, `actionLabels?: Partial<Record<'edit' | 'delete', string>>`, `backTo?: RouteTarget | false`, `updateRoute?: ((record: TRecord) => RouteTarget | undefined) | false`, `can?: (operation: ResourceOperation, record?: TRecord) => boolean`, `deleteRecord?: (record: TRecord) => Promise<unknown>`, `recordIdentity?: (record: TRecord) => RecordIdentity`, `afterDeleteTo?: RouteTarget | false`, `detail: { schema: TSchema }`
- Slots `header: { record, loading, error, refresh, exportControls, updateTarget, can, deleteRecord, deleteState }`, `title: { record, loading, error, refresh, exportControls, updateTarget, can, deleteRecord, deleteState }`, `description: { record, loading, error, refresh, exportControls, updateTarget, can, deleteRecord, deleteState }`, `export-action: { exportControls }`, `edit-action: { record, can, target }`, `delete-action: { record, can, deleteRecord, deleteState }`, `controls: { record, loading, error, refresh, exportControls, updateTarget, can, deleteRecord, deleteState }`, `loading`, `error: { error, refresh }`, `empty`, `read-error: { error, refresh }`, `body: { record, exportControls, detail }`, `[dynamic]: { ...slotProps ?? {} }`

### [Form](src/components/core/Form.vue)

- Props (`FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>`) `schema: RawSchema<TInput, TOutput>`, `fields: TFields & FormFields<TInput, TKeys, TContext, TFields>`, `sections?: readonly FormSection<string>[]`, `labels?: LabelDictionary`, `validators?: readonly FormValidatorEntry<TInput, TOutput, TContext>[]`, `modelValue?: FormDraft<TInput> | undefined`, `initialData?: FormDraft<TInput>`, `load?: (context: RecordLoadContext) => MaybePromise<FormDraft<TInput> | undefined>`, `id?: RecordIdentity`, `resource?: string`, `namespace?: QueryNamespace`, `searchParameters?: Record<string, unknown>`, `context?: TContext`, `normalizeError?: (error: unknown) => SubmitError`, `completeOnSubmit?: boolean`, `disabled?: boolean`, `submitLabel?: string`, `submittingLabel?: string`, `submit: FormSubmit<TOutput, TResult, TContext>`, `submit?: never`, `modelValue: FormDraft<TInput> | undefined`, `name?: string`, `target?: string`
- Slots `input:${TKey}: FormInputSlotProps<TInput, TKey> { value, draft, field, setValue, setError, error, controlBindings, touched, disabled, validating, formValidating }`, `loading`, `load-error: { readonly error: SubmitError; readonly refresh: () => Promise<void> }`, `actions: FormActionSlotProps<TInput, TOutput, TResult, TContext> { submit, reset, refresh, submitting, submitPending, postWriteError, validating, dirty, inputPending }`

### [TableInput](src/components/composites/form-inputs/TableInput.vue)

- Props (`TableInputCoreProps<TInput, TRow, TContext>`) `mode?: 'dialog'`, `fields?: never`, `createRow?: never`, `addLabel?: never`, `table: TableInputTable<TRow, TContext>`, `disabled?: boolean`, `field?: string`, `label?: string`, `helperMessage?: string`, `error?: string`, `required?: boolean`, `context?: TContext`, `form?: never`, `toDraft?: never`, `reorderable?: false`, `rowKey?: never`, `form: TableInputForm<TInput, TRow, TContext>`, `toDraft: (row: TRow) => FormDraft<TInput>`, `reorderable: true`, `rowKey: NonNullable<TableProps<TRow>['rowKey']>`, `rowKey?: TableProps<TRow>['rowKey']`, `reorderable?: boolean`, `mode: 'inline'`, `fields: InlineArrayFields<TRow> | ((row: TRow, index: number) => InlineArrayFields<TRow>)`, `createRow: () => TRow`, `addLabel?: string`, `table?: never`, `v-model: TRow[]`
- Slots `cell:{key}: { row, index, value, touch, setError, setRow, setValue, error, disabled, id }`, `create-button: { controlBindings }`, `table: { data }`

### [DateInput](src/components/inputs/DateInput.vue)

- Props `placeholder?: string`, `locale?: string`, `inline?: boolean`, `withTimePicker?: boolean`, `defaultToCurrent?: boolean`, `minDate?: Date`, `teleport?: DatepickerTeleportTarget`, `field?: string`, `label?: string`, `helperMessage?: string`, `disabled?: boolean`, `error?: string`, `required?: boolean`, `v-model: string | null | undefined`
- Slots None

### [DateRangeInput](src/components/inputs/DateRangeInput.vue)

- Props `placeholder?: string`, `locale?: string`, `unit?: 'arbitrary' | 'week'`, `inline?: boolean`, `teleport?: DatepickerTeleportTarget`, `field?: string`, `label?: string`, `helperMessage?: string`, `disabled?: boolean`, `error?: string`, `required?: boolean`, `v-model: string[]`
- Slots None

### [SelectInput](src/components/inputs/SelectInput.vue)

- Props `placeholder?: string`, `data?: readonly Option[]`, `load?: OptionLoad<Option>`, `resource?: string`, `namespace?: QueryNamespace`, `searchParameters?: Record<string, unknown>`, `defaultToFirst?: boolean`, `pick?: string`, `view?: string`, `multi?: boolean`, `searchable?: boolean`, `asWhole?: boolean`, `transform?: Record<string, string>`, `onSelect?: (selection: Option | Option[] | null) => void`, `clearable?: boolean`, `field?: string`, `label?: string`, `helperMessage?: string`, `disabled?: boolean`, `error?: string`, `required?: boolean`, `v-model: SelectModelValue`
- Slots None

### [DrawingCanvas](src/components/inputs/DrawingCanvas.vue)

- Props (`DrawingCanvasProps<TMode>`) `mode?: TMode`, `maxSize?: number`, `transform?: FileTransform`, `destination?: TMode extends 'file' ? never : string`, `upload?: TMode extends 'file' ? never : UploadOperation<AssetValue>`, `disabled?: boolean`, `error?: string`, `field?: string`, `label?: string`, `helperMessage?: string`, `required?: boolean`, `width?: number`, `height?: number`, `v-model: FileInputModelValue<TMode, false>`
- Slots None

### [Drawer](src/components/base/Drawer.vue)

- Props `title?: string`, `description?: string`, `side?: 'left' | 'right'`, `closeOnOutsideClick?: boolean`, `closeOnEscape?: boolean`, `disabled?: boolean`, `v-model: boolean`
- Slots `trigger: { setOpen, disabled }`, `title: { setOpen }`, `description: { setOpen }`, `content: { setOpen }`, `footer: { setOpen }`

### [MapView](src/components/utils/MapView.vue)

- Props `mapProvider?: 'openstreetmap' | 'google'`, `location?: { lat: number | string; lng: number | string; address?: string } | null`, `center?: { lat: number | string; lng: number | string }`, `lat?: number | string`, `lng?: number | string`, `zoom?: number`
- Slots `markers`

## Form renderers (`defineForm`)

| Form renderer | Component | Unique props | Source |
|---|---|---|---|
| `text` | `TextInput` | `v-model`, `id`, `name`, `readonly`, `placeholder`, `title`, `prefix`, `suffix`, `icon`, `type`, `constraint`, `field`, `label`, `helperMessage`, `disabled`, `error`, `required` | `packages/loom/src/components/inputs/TextInput.vue` |
| `textarea` | `TextareaInput` | `v-model`, `constraint`, `placeholder`, `rows`, `...commonProps` | `packages/loom/src/components/inputs/TextareaInput.vue` |
| `password` | `PasswordInput` | `v-model`, `id`, `name`, `readonly`, `placeholder`, `title`, `prefix`, `suffix`, `icon`, `field`, `label`, `helperMessage`, `disabled`, `error`, `required`, `constraint`, `inputClass` | `packages/loom/src/components/inputs/PasswordInput.vue` |
| `number` | `NumberInput` | `v-model`, `suffix`, `prefix`, `icon`, `placeholder`, `defaultValue`, `locale`, `currency`, `...commonProps` | `packages/loom/src/components/inputs/NumberInput.vue` |
| `select` | `SelectInput` | `v-model`, `placeholder`, `data`, `load`, `resource`, `namespace`, `searchParameters`, `defaultToFirst`, `pick`, `view`, `multi`, `searchable`, `asWhole`, `transform`, `onSelect`, `clearable`, `...commonProps` | `packages/loom/src/components/inputs/SelectInput.vue` |
| `radio` | `RadioGroupInput` | `v-model`, `data`, `load`, `resource`, `namespace`, `view`, `pick`, `variant`, `direction`, `defaultValue`, `searchParameters`, `...commonProps` | `packages/loom/src/components/inputs/RadioGroupInput.vue` |
| `date` | `DateInput` | `v-model`, `placeholder`, `locale`, `inline`, `withTimePicker`, `defaultToCurrent`, `minDate`, `teleport`, `...commonProps` | `packages/loom/src/components/inputs/DateInput.vue` |
| `daterange` | `DateRangeInput` | `v-model`, `placeholder`, `locale`, `unit`, `inline`, `teleport`, `...commonProps` | `packages/loom/src/components/inputs/DateRangeInput.vue` |
| `month` | `MonthInput` | `v-model`, `locale`, `inline`, `defaultToCurrent`, `placeholder`, `minDate`, `teleport`, `...commonProps` | `packages/loom/src/components/inputs/MonthInput.vue` |
| `year` | `YearInput` | `v-model`, `placeholder`, `locale`, `inline`, `defaultToCurrent`, `teleport`, `...commonProps` | `packages/loom/src/components/inputs/YearInput.vue` |
| `time` | `TimeInput` | `v-model`, `placeholder`, `locale`, `defaultToCurrent`, `teleport`, `...commonProps` | `packages/loom/src/components/inputs/TimeInput.vue` |
| `checkbox` | `CheckboxInput` | `v-model`, `onToggle`, `onActive`, `onDeactive`, `description`, `checked`, `static`, `...commonProps` | `packages/loom/src/components/inputs/CheckboxInput.vue` |
| `checkbox-group` | `CheckboxGroupInput` | `v-model`, `pick`, `view`, `searchParameters`, `data`, `load`, `resource`, `namespace`, `uniqueIDAs`, `...commonProps` | `packages/loom/src/components/inputs/CheckboxGroupInput.vue` |
| `switch` | `Switch` | `v-model`, `onToggle`, `onActive`, `onDeactive`, `label`, `description`, `size`, `disabled`, `field`, `helperMessage`, `error`, `required` | `packages/loom/src/components/inputs/Switch.vue` |
| `file` | `FileInput` | `v-model`, `mode`, `accept`, `maxSize`, `multi`, `limit`, `transform`, `destination`, `upload`, `disabled`, `error`, `field`, `label`, `helperMessage`, `required` | `packages/loom/src/components/inputs/FileInput.vue` |
| `image` | `ImageInput` | `v-model`, `mode`, `accept`, `maxSize`, `multi`, `limit`, `transform`, `destination`, `upload`, `disabled`, `error`, `field`, `label`, `helperMessage`, `required`, `disableInformation`, `additionalInfo` | `packages/loom/src/components/inputs/ImageInput.vue` |
| `tag` | `TagInput` | `v-model`, `prefix`, `suffix`, `icon`, `placeholder`, `constraint`, `separator`, `validator`, `...commonProps` | `packages/loom/src/components/inputs/TagInput.vue` |
| `color` | `ColorInput` | `v-model`, `presetColors`, `placeholder`, `...commonProps` | `packages/loom/src/components/inputs/ColorInput.vue` |
| `lookup` | `LookupInput` | `v-model`, `table`, `context`, `loadDetail`, `searchParameters`, `namespace`, `view`, `multi`, `pick`, `placeholder`, `field`, `label`, `helperMessage`, `error`, `disabled`, `required`, `data`, `load` | `packages/loom/src/components/composites/form-inputs/LookupInput.vue` |
| `location` | `LocationInput` | `v-model`, `mapProvider`, `operations`, `...commonProps` | `packages/loom/src/components/composites/form-inputs/LocationInput.vue` |
| `multi-location` | `MultiLocationInput` | `v-model`, `mapProvider`, `operations`, `addLabel`, `emptyLabel`, `...commonProps` | `packages/loom/src/components/composites/form-inputs/MultiLocationInput.vue` |
| `rich-text` | `RichTextInput` | `v-model`, `contentType`, `height`, `...commonProps` | `packages/loom/src/components/inputs/RichTextInput.vue` |
| `icon-select` | `IconSelectInput` | `v-model`, `...commonProps` | `packages/loom/src/components/inputs/IconSelectInput.vue` |
| `table` | `TableInput` | `v-model`, `mode`, `fields`, `createRow`, `addLabel`, `table`, `disabled`, `field`, `label`, `helperMessage`, `error`, `required`, `context`, `form`, `toDraft`, `reorderable`, `rowKey` | `packages/loom/src/components/composites/form-inputs/TableInput.vue` |
| `separator` | `FormSeparator` | `label` | `packages/loom/src/components/composites/form-inputs/FormSeparator.vue` |
| `canvas` | `DrawingCanvas` | `v-model`, `mode`, `maxSize`, `transform`, `destination`, `upload`, `disabled`, `error`, `field`, `label`, `helperMessage`, `required`, `width`, `height` | `packages/loom/src/components/inputs/DrawingCanvas.vue` |

## App display renderers and formatters

| Display renderer | Extra props | Source |
|---|---|---|
| `chip` | `options` | `apps/web/src/framework/display/renderers.ts` |
| `image` | - | `apps/web/src/framework/display/renderers.ts` |
| `file` | - | `apps/web/src/framework/display/renderers.ts` |
| `array-clauses` | - | `apps/web/src/framework/display/renderers.ts` |

- Default parser formatters (`@southneuhof/utilities/parse`, configured in `apps/web/src/main.ts`): `number`, `largeNumber`, `currency`, `month`, `date`, `time`, `datetime`, `hour`, `delta`
- Plain multi-line strings in `Detail` and `Table` preserve newlines automatically via `DisplayValue.vue` (`whitespace-pre-line`).

## Core factories, composables, and utilities (`@southneuhof/loom`)

| Export | Signature | Source |
|---|---|---|
| `defineForm` | `defineForm<TSchema, TFields>(definition: { schema, fields, sections, labels, validators, submit })` | `packages/loom/src/forms/defineForm.ts` |
| `defineTable` | `defineTable<TSchema, TColumns, TLabels?>(definition: TableArgument<TSchema, TColumns> & { readonly labels?: TLabels })` | `packages/loom/src/tables/defineTable.ts` |
| `defineDetail` | `defineDetail<TSchema, TFields, TLabels?>(definition: DetailArgument<TSchema, TFields> & { readonly labels?: TLabels })` | `packages/loom/src/details/defineDetail.ts` |
| `defineResource` | `defineResource<TIdentityFunction, TDefinition>(definition: TDefinition | LoadedResourceDefinition<TIdentityFunction, ResourceRec...)` | `packages/loom/src/resources/defineResource.ts` |
| `useCollection` | `useCollection<TRecord, TQuery>(sourceGetter: () => CollectionProps<TRecord, TQuery>, options?: UseCollectionOptions)` | `packages/loom/src/components/core/useCollection.ts` |
| `useRecord` | `useRecord<TRecord, TContext?>(sourceGetter: () => DetailProps<TRecord, TContext>)` | `packages/loom/src/components/core/useRecord.ts` |
| `useLoader` | `useLoader<TContext, TResult>(options: LoaderOptions<TContext, TResult>)` | `packages/loom/src/query/loader.ts` |
| `useNamespacedQuery` | `useNamespacedQuery(options: NamespacedQueryOptions)` | `packages/loom/src/query/namespace.ts` |
| `downloadBlob` | `downloadBlob(response: Response, fallbackFilename: string)` | `packages/loom/src/services/download.ts` |
| `parseFilenameFromContentDisposition` | `parseFilenameFromContentDisposition(header: string | null)` | `packages/loom/src/services/download.ts` |

- In `defineTable` and `defineDetail`, put display titles in top-level `labels`. Use entry `label` for an override. Table columns accept `sortable` and `read`. When a column sets `cell`, put `read` and `format` inside `cell`.
- Use `apps/web/src/manifest/navigation.ts` as the reference for `VisibleNavigationModule`. Use `kind`, `name`, `title`, `icon`, and `routes`. The navigation declaration also accepts `description`.

## Resource custom commands and exports

- In `defineResource`, declare writes as command objects (`{ permission, run }`) and read-only loaders as functions in `actions`.
- Command options `run`, `permission`, `routePermission`, `visible`, `route`, `invalidates`. Use the bound command at `resource.actions.name`.
- Bound command members `can`, `run`, `route`, `withContext`. Call `withContext({ record })` for record access checks. Pass the same operation arguments to `can(...args)` and `run(...args)`. `run` checks access and invalidates queries after success.
- Set `exports.list.downloads` for custom downloads in the list export menu. Type `downloads?: readonly ExportDownloadOption<TQuery>[]`. Each entry has `label: string`, `run(context: { query: TQuery; signal: AbortSignal }): MaybePromise<void>`.

## Resource and web transport helpers

- `@southneuhof/loom` resource API: `defineResource(definition)`
  - `defineResource` keys: `key`, `identity`, `list`, `create`, `detail`, `update`, `delete`, `exports`, `actions`
  - `create` / `update` / `delete` write options include: `successMessage`, `backTo`, `defaultTo`, `permission`, `route`, `visible`, `invalidates`
- `@/framework/hono`: `runHonoMutation(operation, request)`, `createHonoResourceActions(route, options?)`, `parseHonoResponse(response)`
- `@/framework/schema`: `checkedHonoRecordSchema(_route, schema)`, `checkedHonoResponseRecordSchema(_endpoint, schema)`, `checkedHonoCreateSchema(_route, schema)`, `checkedHonoUpdateSchema(_route, schema)`
