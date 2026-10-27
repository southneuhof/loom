# @southneuhof/loom

Loom provides Vue forms, tables, detail displays, resource binding, and common
page views. The application owns routes, transport, workflow behavior, and
backend authorization.

Follow the [current direct module authoring path](../../docs/resource_system_overhaul/ARCHITECTURE.md#direct-module-authoring)
for the active Loom contract. This README links to package examples and checks.

## Install the framework

Install `FrameworkPlugin` once. Supply only the adapters and registries that the
application uses:

```ts
import { FrameworkPlugin } from '@southneuhof/loom'

app.use(FrameworkPlugin, {
  adapters,
  renderers: { display: appDisplayRenderers },
  uiDefaults,
})
```

## Define surfaces

Use a raw schema for each operation. Define form input, table columns, and
detail fields independently:

```ts
import { defineDetail, defineForm, defineTable } from '@southneuhof/loom'

const labels = { name: 'Name', status: 'Status' }
const statusDisplay = { renderer: 'chip', props: { options: statusLabels } }
const statusChoices = Object.entries(statusLabels).map(([id, name]) => ({ id, name }))

export const usersTable = defineTable({
  schema: userRecordSchema,
  labels,
  columns: {
    name: { sortable: true },
    status: { ...statusDisplay },
  },
})

export const userDetail = defineDetail({
  schema: userRecordSchema,
  labels,
  fields: {
    name: {},
    status: { ...statusDisplay },
  },
})

export const createUserForm = defineForm({
  schema: createUserSchema,
  labels,
  fields: {
    name: { renderer: 'text' },
    status: { renderer: 'select', props: { data: statusChoices, pick: 'id', view: 'name' } },
  },
  submit: userActions.create,
})
```

Each map is ordered and checked against its own schema. Form fields are input
definitions. Table columns and detail fields are display definitions. Share a
plain fragment with object spread when the same display behavior is needed in
both maps. Every form field declares its renderer. Its flat `props` object uses
the selected component's public props; put loaders such as `load` and
`namespace` in that object. The schema supplies requiredness but does not infer
renderers or choices.

A custom input that owns its own data set uses `useLoader` for reads. It shares
the installed query client's deduplication, cancellation, retry, and terminal
failure feedback. Keep the loader's `enabled` setting separate from an input's
interaction `disabled` prop.

With no display renderer, Loom renders scalar values as text and nullish values
as `-`. Dates need an explicit format. Structured values need a renderer or an
accessor/formatter that returns displayable text. Do not return raw objects for
text display.

## Bind a resource

`defineResource` takes one declaration object. Every standard operation needs
an explicit permission string or `null`:

```ts
import { defineResource } from '@southneuhof/loom'

export const users = defineResource({
  key: 'users',
  identity: (record: Pick<User, 'id'>) => record.id,
  list: {
    permission: 'view-users',
    route: { name: 'settings-users' },
    table: { ...usersTable, load: userActions.list },
  },
  create: {
    permission: 'create-users',
    route: { name: 'settings-users-create' },
    form: createUserForm,
  },
  detail: {
    permission: 'view-users',
    route: {
      name: 'settings-users-detail',
      params: id => ({ userId: String(id) }),
    },
    detail: ({ id }) => ({
      ...userDetail,
      load: context => userActions.detail({ ...context, id }),
    }),
  },
  update: {
    permission: 'update-users',
    route: {
      name: 'settings-users-edit',
      params: id => ({ userId: String(id) }),
    },
    form: ({ id }) => ({
      ...updateUserForm,
      load: async context => {
        const record = await userActions.detail({ ...context, id })
        return record ? { name: record.name } : undefined
      },
      submit: output => userActions.update(id, output),
    }),
  },
  delete: { permission: 'delete-users', run: userActions.delete },
  actions: {
    verify: { permission: 'verify-users', run: userActions.verify },
  },
})
```

List and create bind page bags with `users.list()` and `users.create()`.
Detail and update bind identity with `users.detail({ id })` and
`users.update({ id })`. Update owns its draft loader and submit function. The
loader maps record values to input values explicitly. Delete is a command;
custom commands live in `actions` and expose guarded `can` and `run` functions.
Both functions take the business arguments declared by `run`. Bind row policy
context separately with `withContext({ record })`:

```ts
const command = users.actions.verify.withContext({ record })
if (command.can(payload)) await command.run(payload)
```

Binding copies the record used for policy checks. It does not append the record
to the command arguments. Successful create/update results must identify the
resource. An invalid result is an uncertain, non-retryable post-write error.
When a valid write result is followed by a failed active read, the binder keeps
the original result and provides a read-only recovery callback. A refresh never
repeats the write. Canceled or superseded reads do not change the known write
outcome.

At resource composition, sortable columns are checked against the non-null
`sort_by` values in the typed table loader query. An implicit sort key uses the
column key; an explicit `sortKey` uses that key. A typed query with no
`sort_by` permits no sortable columns. Broad query types retain the current
record-key checks. The Hono adapter remains the runtime query validator.

The binder owns resource identity, route access registration, permission
checks, cache namespaces, and invalidation after successful standard writes.
The backend remains the final authorization boundary.

## Use page views

Pass the operation bag directly to its View:

```vue
<ListView v-bind="users.list()" />
<DetailView v-bind="users.detail({ id })" />
<FormView v-bind="users.create()" />
<FormView v-bind="users.update({ id })" />
```

Routes own navigation, dialogs, confirmations, notifications, and workflow
state. Use `Table`, `Detail`, or `Form` directly when a page does not need a
standard resource View.

Use `TreeTableContent` when a nonstandard page owns the collection load and
passes loaded tree records to Loom. It keeps the table slots and query controls.
Expansion uses local state by default. Set `expandedKeys` to control it:

```vue
<TreeTableContent
  :schema="schema"
  :columns="columns"
  :records="records"
  :query="query"
  :loading="loading"
  :empty="empty"
  row-key="key"
  :children="node => node.children"
  tree-column="name"
  v-model:expanded-keys="expandedKeys"
/>
```

Use `default-expanded-keys` for initial uncontrolled state. Its exposed
`expandAll`, `collapseAll`, and `reveal(keys)` methods support page controls.
`reveal` opens the parent rows needed to show the requested row keys.

## Forms and assets

Forms keep the editable draft in input shape. The raw form schema parses it to
the submit shape. Use schema transforms for value conversion. Defaults come
from explicit input factories or `initialData`; schema defaults run during
parsing.

Form owns validation state and labels. BaseInput is the only validation message
renderer. It shows helper text and errors as separate messages after the
control, in that order. Raw `input:<key>` slots receive typed
`controlBindings`; bind them to the actual focusable control. Do not print a
second error or nest another message-bearing BaseInput in a custom slot.

Built-in file and image inputs keep the same stored asset objects through load,
edit, and submit. Do not add client identity conversion. Shared form readiness
blocks submission while transform or upload work remains pending. Set
`mode: 'file'` on FileInput or ImageInput when the draft needs a local `File`.
The same `mode` applies to camera capture and drawing export. File mode does
not upload files and does not require `adapters.assets`. Read file text or
send bytes in the application's submit action, then build the wire payload
there. The JSON import example reads `File.text()` and sends `{ fileText }`;
the file byte limit and endpoint text length limit are separate checks. See
[`assets.form.spec.ts`](../../apps/web/src/framework/adapters/assets.form.spec.ts)
for the executable boundary example.

### File hooks

`mode` selects the model shape. A `transform` runs before local commit in file
mode and before the default `adapters.assets.upload` in asset mode. It returns
a `File` in either mode. The same transform can serve both:

```ts
const preparePhoto = async (
  file: File,
  { signal }: { signal: AbortSignal },
): Promise<File> =>
  imageActions.addTimestamp(file, { signal })

const fields = {
  uploadedPhoto: {
    renderer: 'image',
    props: { transform: preparePhoto, destination: 'profile-photos' },
  },
  localPhoto: {
    renderer: 'image',
    props: { mode: 'file', transform: preparePhoto },
  },
}
```

Set `upload` only to replace asset transport. It uses the same context shape as
the asset service, including `destination`, `signal`, and `onProgress`, and
returns `AssetValue`:

```ts
import type { UploadOperation } from '@southneuhof/loom'
import type { AssetValue } from '@southneuhof/loom/assets'

const uploadReceipt: UploadOperation<AssetValue> = async (
  file,
  { destination, signal, onProgress },
) => {
  const stored = await receiptActions.upload(file, { destination, signal, onProgress })
  return { kind: 'file', id: stored.id, url: stored.url, name: stored.name }
}

const receiptField = {
  renderer: 'file',
  props: { destination: 'receipts', upload: uploadReceipt },
}
```

Asset mode still needs `adapters.assets` for canonical `read` and `preview`.
File mode does not upload and does not need that adapter. Keep arbitrary
responses and wire payloads in the application's action that reads the local
`File`.

An uncertain or legacy submit error with `postWrite: true` keeps the draft and
blocks another save for the same resource and record identity. The alert tells
the user to check the record before starting another save. A confirmed refresh
failure says the write was saved and offers Retry refresh. That action retries
reads only and clears the block after a successful read. Edits, reset, ordinary
refresh, schema or field changes, and view-scope changes do not clear an
uncertain block; a resource or record identity change does. A new Form mount
starts a new local session, so mounted guards do not provide server
idempotency across remounts.

`DialogForm` owns ordinary visibility and completion. Use one keyed dialog for
each record action. Bind `open` only when another page control must coordinate
visibility.

## Executable examples

Use these fixtures as current contract examples. They exercise real components
and application source. Loom checks its type fixtures; the web type check checks
application source.

| Contract | Fixture |
|---|---|
| BaseInput message order and links, managed Form delegation, custom slots, and summaries | [base-input.spec.ts](src/components/inputs/__tests__/base-input.spec.ts), [form.spec.ts](src/components/core/__tests__/form.spec.ts), [Form.browser.spec.ts](src/components/core/__tests__/Form.browser.spec.ts) |
| One numeric SelectInput prop bag in standalone, Form, and DialogForm | [SelectForm.browser.spec.ts](src/components/composites/__tests__/SelectForm.browser.spec.ts) |
| DateInput string model, submit override, and managed input slots | [SurfaceParity.browser.spec.ts](src/components/composites/__tests__/SurfaceParity.browser.spec.ts), [date-input-model.type-test.ts](src/components/composites/__type-tests__/date-input-model.type-test.ts), [plan067-form-contracts.type-test.vue](src/components/composites/__type-tests__/plan067-form-contracts.type-test.vue) |
| App-scoped assets for direct and managed inputs and previews | [AssetParity.browser.spec.ts](src/assets/__tests__/AssetParity.browser.spec.ts) |
| Local File draft reset and text submit without an asset adapter | [FileInput.browser.spec.ts](src/components/inputs/__tests__/FileInput.browser.spec.ts), [file input mode types](src/components/inputs/__type-tests__/input-model-modes.type-test.vue) |
| Shared relation display in Table, TreeTable, Detail, and extraction | [DisplayParity.browser.spec.ts](src/components/core/__tests__/DisplayParity.browser.spec.ts) |
| Shared relation accessor and format in exports | [export.spec.ts](src/services/__tests__/export.spec.ts) |
| Editable row mapping and submit-free row form | [TableInput.browser.spec.ts](src/components/composites/__tests__/TableInput.browser.spec.ts), [table-input.type-test.ts](src/components/composites/__type-tests__/table-input.type-test.ts) |
| Application resource bags and extracted page props | [users.resource.ts](../../apps/web/src/routes/%28authenticated%29/settings/users/users.resource.ts), [index.route.vue](../../apps/web/src/routes/%28authenticated%29/settings/users/index.route.vue), [detail.route.vue](../../apps/web/src/routes/%28authenticated%29/settings/users/%5BuserId%5D/detail.route.vue), [edit.route.vue](../../apps/web/src/routes/%28authenticated%29/settings/users/%5BuserId%5D/edit.route.vue) |

## Checks and exports

Use Loom and web type checks for surface and app contracts. Run web lint and
focused tests for changed app owners. The [surface architecture guide](../../docs/resource_system_overhaul/ARCHITECTURE.md)
and [web verification guide](../../.agents/skills/web-ui-surfaces/references/verification.md)
describe the current checks.

| Import | Purpose |
|---|---|
| `@southneuhof/loom` | Surface constructors, resource binding, views, components, and framework setup |
| `@southneuhof/loom/components/*` | Component subpaths |
| `@southneuhof/loom/renderers/*` | Renderer contracts |
| `@southneuhof/loom/adapters/*` | Application adapter contracts |
| `@southneuhof/loom/router/*` | Router utilities |
| `@southneuhof/loom/file-manager` | Optional file-manager integration |
