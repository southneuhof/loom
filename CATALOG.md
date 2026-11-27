# Loom and web framework catalog

Generated from source by `node scripts/generate-framework-catalog.mjs`. Do not edit by hand.

## Views and core components

| Component | Models and props | Slots | Source |
|---|---|---|---|
| `ListView` | `title`, `description`, `actionLabels`, `filters`, `filterControls`, `bodyVariant`, `exportAccess`, `export`, `table`, `createRoute`, `detailRoute`, `updateRoute`, `can`, `deleteRecord`, `recordIdentity` | `row-actions-view`, `row-actions-edit`, `row-actions-delete`, `row-actions`, `header`, `column-dialog`, `export-action`, `toolbar`, `create-action`, `resource-action`, `filters`, `context`, `body`, `collection`, `[dynamic]`, `footer` | `packages/loom/src/components/views/ListView.vue` |
| `DetailView` | `detail`, `exportAccess`, `export`, `title`, `description`, `actionLabels`, `backTo`, `updateRoute`, `can`, `deleteRecord`, `recordIdentity`, `afterDeleteTo` | `header`, `export-action`, `secondary-controls`, `edit-action`, `delete-action`, `controls`, `loading`, `error`, `empty`, `read-error`, `body`, `[dynamic]` | `packages/loom/src/components/views/DetailView.vue` |
| `FormView` | `form`, `title`, `description`, `backTo`, `defaultTo`, `completion`, `afterSubmit`, `successMessage` | `header`, `controls`, `saved`, `loading`, `load-error`, `body`, `[dynamic]`, `actions`, `footer` | `packages/loom/src/components/views/FormView.vue` |
| `PageHeader` | `title`, `description`, `backTo`, `backLabel` | `header`, `toolbar`, `controls`, `subbar` | `packages/loom/src/components/views/PageHeader.vue` |
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
| `Drawer` | `isOpen`, `title`, `onClose`, `onOpen`, `disabled` | `trigger`, `content` | `packages/loom/src/components/base/Drawer.vue` |
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
| `MultiLocationInput` | `v-model`, `mapProvider`, `operations`, `...commonProps` | - | `packages/loom/src/components/composites/form-inputs/MultiLocationInput.vue` |

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
| `multi-location` | `MultiLocationInput` | `v-model`, `mapProvider`, `operations`, `...commonProps` | `packages/loom/src/components/composites/form-inputs/MultiLocationInput.vue` |
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

## Resource and web transport helpers

- `@southneuhof/loom` resource API: `defineResource(definition)`
  - `defineResource` keys: `key`, `identity`, `list`, `create`, `detail`, `update`, `delete`, `exports`, `actions`
  - `create` / `update` / `delete` write options include: `successMessage`, `backTo`, `defaultTo`, `permission`, `route`, `visible`, `invalidates`
  - custom command options (`actions.<name>`): `run`, `permission`, `routePermission`, `visible`, `route`, `invalidates`
- `@/framework/hono`: `runHonoMutation(operation, request)`, `createHonoResourceActions(route, options?)`, `parseHonoResponse(response)`
- `@/framework/schema`: `checkedHonoRecordSchema(_route, schema)`, `checkedHonoResponseRecordSchema(_endpoint, schema)`, `checkedHonoCreateSchema(_route, schema)`, `checkedHonoUpdateSchema(_route, schema)`
