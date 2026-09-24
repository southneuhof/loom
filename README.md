# @southneuhof/loom

Loom provides Vue forms, tables, detail displays, resource binding, and common
page views. The application owns routes, transport, workflow behavior, and
backend authorization.

Read the [Carta resource architecture](../../docs/resource_system_overhaul/ARCHITECTURE.md)
for the full contract and type boundaries.

## Install the framework

Install `FrameworkPlugin` once. Supply only the adapters and registries that the
application uses:

```ts
import { FrameworkPlugin } from '@southneuhof/loom'

app.use(FrameworkPlugin, {
  adapters,
  renderers: { display: appDisplayRenderers },
  inputProps: appInputProps,
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
    status: { renderer: 'select', props: { options: statusLabels } },
  },
  submit: userActions.create,
})
```

Each map is ordered and checked against its own schema. Form fields are input
definitions. Table columns and detail fields are display definitions. Share a
plain fragment with object spread when the same display behavior is needed in
both maps.

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

The list and create page bags are static: `users.list` and `users.create`.
Detail and update bind identity: `users.detail({ id })` and
`users.update({ id })`. Update owns its draft loader and submit function. The
loader maps record values to input values explicitly. Delete is a command;
custom commands live in `actions` and expose guarded `can` and `run` functions.

The binder owns resource identity, route access registration, permission
checks, cache namespaces, and invalidation after successful standard writes.
The backend remains the final authorization boundary.

## Use page views

Pass the operation bag directly to its View:

```vue
<ListView v-bind="users.list" />
<DetailView v-bind="users.detail({ id })" />
<FormView v-bind="users.create" />
<FormView v-bind="users.update({ id })" />
```

Routes own navigation, dialogs, confirmations, notifications, and workflow
state. Use `Table`, `Detail`, or `Form` directly when a page does not need a
standard resource View.

## Forms and assets

Forms keep the editable draft in input shape. The raw form schema parses it to
the submit shape. Use schema transforms for value conversion. Defaults come
from explicit input factories or `initialData`; schema defaults run during
parsing.

Built-in file and image inputs keep the same stored asset objects through load,
edit, and submit. Do not add client identity conversion. Shared form readiness
blocks submission while upload work remains pending. See
[`assets.form.spec.ts`](../../apps/web/src/framework/adapters/assets.form.spec.ts)
for the executable boundary example.

`DialogForm` owns ordinary visibility and completion. Use one keyed dialog for
each record action. Bind `open` only when another page control must coordinate
visibility.

## Checks and exports

Run the checker on changed route directories:

```sh
node scripts/module-ui-check.mjs --sources 'apps/web/src/routes/(authenticated)/<module>'
```

The checker follows resource surface maps and their local fragments. Review its
display messages against returned values and API contracts. A pass does not
prove visual acceptance.

| Import | Purpose |
|---|---|
| `@southneuhof/loom` | Surface constructors, resource binding, views, components, and framework setup |
| `@southneuhof/loom/components/*` | Component subpaths |
| `@southneuhof/loom/renderers/*` | Renderer contracts |
| `@southneuhof/loom/adapters/*` | Application adapter contracts |
| `@southneuhof/loom/router/*` | Router utilities |
| `@southneuhof/loom/file-manager` | Optional file-manager integration |
