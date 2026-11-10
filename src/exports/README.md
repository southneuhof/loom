# Resource exports

Loom uses the `@southneuhof/spool` workspace package in `packages/spool` for document preparation, native PDF printing, and XLSX output. Spool has its own source and public repository. The package sync commands include Spool with Loom and Sprindle.

List exports stay enabled by default. `export: false` disables a standalone ListView or an existing resource list declaration. `exports.list` on a resource takes precedence over the list declaration. Detail exports require `exports.detail` or the DetailView `export` prop.

```ts
const users = defineResource({
  key: 'users',
  identity: (record: User) => record.id,
  list: { permission: 'users.view', table: usersTable },
  detail: {
    permission: 'users.show',
    detail: ({ id }) => ({ ...userDetail, id, load: loadUser }),
  },
  exports: {
    list: { filename: ({ query }) => `users-${query.status}`, sheetName: 'Users' },
    detail: { filename: 'user' },
  },
})
```

Each export configuration inherits the effective view configuration. An explicit `table.columns` or `detail.fields` replaces that ordered field map. Without an explicit export column map, the list uses the user's visible columns. Label, context, query, and search parameter objects inherit missing entries.

List options retain `pageSize`, `sheetName`, callable `filename({ query })`, `mapValue({ record, field, value })`, and the export-specific `load` callback. The callback returns a complete array or collection result. `table.load` instead uses the normal page collection process. Default collection exports retain active filters, sort, search parameters, and context. They collect all pages. An incomplete empty page, repeated page, or page safety limit raises an error.

List output supports `formats: ['xlsx', 'pdf']`. The default download button opens `Menu`. PDF opens the native print dialog. XLSX opens the workbook preview. The preview has a download action and sheet selection. Detail output supports PDF only. List reports use landscape. Detail reports use portrait. Set `orientation` to change this default.

Export field entries can add `xlsx` with `value`, `numberFormat`, and `hyperlink`. A value callback receives `{ record, context, value }`. Display accessors, per-row fields, formatters, and renderers remain available. An explicit typed XLSX value takes precedence over rendered text.

Set `component` to a Vue report component. It receives `rows`, `record`, `document`, `context`, and `config`. Use the components from `@southneuhof/spool/vue` or custom HTML. `styles` selects inherited or isolated styles. The built-in report uses isolated styles.

## Controls

ListView exposes `exportControls` through `header`, `toolbar`, `resource-action`, `body`, `collection`, `footer`, and `export-action`. DetailView exposes it through `header`, `controls`, `body`, and `export-action`. Existing slot props remain available.

Controls provide `available`, `disabled`, `pending`, `error`, `formats`, `openPreview()`, `printPdf()`, and `downloadXlsx()`. An empty `export-action` slot hides the default action. Output commands use the prepared snapshot. A source change cancels preparation and updates an open preview.

## Access and scope

Bound resources recheck access for exports. Detail reports also check the bound record identity, including composite identities.

Alternate export loaders, data, and changed queries require the effective source to have `sourceGuard`. The guard has synchronous `beforeLoad(context)` and `record(record)` assertions. Keep fixed project restrictions in this guard when an alternate loader is possible. Normal readers and exports both enforce the guard. `composeSourceGuards` adds restrictions without replacing existing restrictions. Bound resource access remains enforced when an export override supplies another guard.

For a report without a Loom resource, use `usePrint` or `useXlsx` from `@southneuhof/spool/vue`. The report owns authorized data and its mounted template. See the [Spool guide](https://github.com/southneuhof/spool#readme).
