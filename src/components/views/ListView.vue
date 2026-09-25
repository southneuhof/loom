<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TFilterInput extends object = Partial<TQuery>">
/**
 * Collection surface shell.
 *
 * Owns Card, page title, toolbar, filters, and the selected collection
 * presentation. Collection owns the one data lifecycle for the body.
 */
import { computed, nextTick, ref, useSlots, watch } from "vue";
import { toast } from "vue-sonner";
import type {
  CollectionSlotProps,
  FormDraft,
  QueryValues,
  RowReorderPayload,
  SchemaParseResult,
  TableProps,
} from "../../contracts";
import type { FormDraftSnapshot } from "../../contracts/forms";
import type { ListViewActions, ListViewProps } from "../../contracts/views";
import type { RouteLocationRaw } from "vue-router";
import { resolveDisplayFields } from "../../display/resolveDisplay";
import Table from "../core/Table.vue";
import Form from "../core/Form.vue";
import Button from "../base/Button.vue";
import Card from "../base/Card.vue";
import Dialog from "../base/Dialog.vue";
import Icon from "../base/Icon.vue";
import Popover from "../base/Popover.vue";
import SearchBox from "../inputs/SearchBox.vue";
import Switch from "../inputs/Switch.vue";
import { exportTableRows } from "../../services";
import { useTablePreferences } from "../core/useTablePreferences";

const props = defineProps<ListViewProps<TRecord, TQuery, TFilterInput>>();
const emit = defineEmits<{
  (event: "update:query", query: QueryValues): void;
  (event: "export-error", error: unknown): void;
  (event: "row-reorder", payload: RowReorderPayload<TRecord>): void;
}>();
const slots = useSlots();
defineSlots<{
  [name: `cell:${string}`]: (props: { value: unknown; record: TRecord; field: unknown; index: number }) => unknown;
  collection?: (props: CollectionSlotProps<TRecord, TQuery> & { actions?: ListViewActions<TRecord> }) => unknown;
  /**
   * Per-standard-action overrides. The framework owns visibility: each region
   * renders only when its action is declared and permitted, so custom content
   * never needs its own permission checks. Props are for nuance only.
   */
  "row-actions-view"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-edit"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-delete"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; deleteRecord?: ListViewActions<TRecord>["deleteRecord"] }) => unknown;
  "create-action"?: (props: { can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "resource-action"?: () => unknown;
  header?: () => unknown;
  filters?: () => unknown;
  body?: (props: { table: TableProps<TRecord, TQuery> }) => unknown;
  footer?: () => unknown;
  "row-actions"?: (props: { record: TRecord }) => unknown;
}>();

type ListViewSurface = {
  table: TableProps<TRecord, TQuery>;
  createRoute?: RouteLocationRaw;
  detailRoute?: (record: TRecord) => RouteLocationRaw | undefined;
  updateRoute?: (record: TRecord) => RouteLocationRaw | undefined;
  can?: ListViewActions<TRecord>["can"];
  deleteRecord?: ListViewActions<TRecord>["deleteRecord"];
};

const surface = computed<ListViewSurface>(() => {
  return {
    table: {
      ...props.table,
      pagination: props.table.pagination ?? "always",
    },
    createRoute: props.createRoute === false ? undefined : props.createRoute,
    detailRoute: props.detailRoute === false ? undefined : props.detailRoute,
    updateRoute: props.updateRoute === false ? undefined : props.updateRoute,
    can: props.can,
    deleteRecord: props.deleteRecord,
  };
});

const tableRef = ref<{ refresh: () => Promise<void>; query: QueryValues; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void }>();
const currentQuery = computed<QueryValues>(() => tableRef.value?.query
  ?? (props.table.query as QueryValues | undefined)
  ?? { page: 1, limit: props.table.defaultPageSize ?? 10 });
const filterDraftState = ref<FormDraft<TFilterInput>>({ ...(props.filters?.defaults ?? {}), ...filterValues(currentQuery.value) });
const filterDraft = computed(() => filterDraftState.value);
const filterFormRef = ref<{ validate: () => Promise<SchemaParseResult<Partial<TQuery>>>; reset: () => void }>();
let filterValidation = 0;
let lastFilterOutputKeys = new Set<string>();
let pendingFilterQuery: QueryValues | undefined;

const tableBindings = computed(() => surface.value.table);

function applyQuery(patch: QueryValues) {
  tableRef.value?.updateQuery(patch);
}

function onTableQuery(values: QueryValues) {
  filterValidation += 1;
  emit("update:query", values);
}

function sameQuery(left: QueryValues, right: QueryValues): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}

watch(currentQuery, (values) => {
  filterValidation += 1;
  if (pendingFilterQuery && sameQuery(values, pendingFilterQuery)) {
    pendingFilterQuery = undefined;
    return;
  }
  pendingFilterQuery = undefined;
  filterDraftState.value = { ...(props.filters?.defaults ?? {}), ...filterValues(values) };
}, { deep: true });

function filterValues(values: QueryValues): Partial<TFilterInput> {
  const keys = new Set([
    ...Object.keys(props.filters?.fields ?? {}),
    ...Object.keys(props.filters?.defaults ?? {}),
  ]);
  return Object.fromEntries([...keys].filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]])) as Partial<TFilterInput>;
}

function rowReorder(payload: RowReorderPayload<TRecord>) {
  emit("row-reorder", payload);
}

async function updateFilters(next: FormDraftSnapshot<TFilterInput>, baseQuery: QueryValues = currentQuery.value) {
  filterDraftState.value = { ...next };
  const validation = ++filterValidation;
  await nextTick();
  if (validation !== filterValidation) return;
  const result = await filterFormRef.value?.validate();
  if (!result?.success || validation !== filterValidation) return;

  const filterKeys = new Set([
    ...lastFilterOutputKeys,
    ...Object.keys(props.filters?.fields ?? {}),
    ...Object.keys(props.filters?.defaults ?? {}),
    ...Object.keys(result.data),
  ]);
  const query = { ...baseQuery };
  for (const key of filterKeys) delete query[key];
  for (const [key, value] of Object.entries(result.data)) {
    if (value !== undefined) query[key] = value;
  }
  query.page = 1;
  lastFilterOutputKeys = new Set(Object.keys(result.data));
  pendingFilterQuery = query;
  tableRef.value?.replaceQuery(query);
}

function resetFilters() {
  filterFormRef.value?.reset();
}

const passthroughSlots = computed(() =>
  Object.entries(slots).filter(
    ([name]) =>
      ![
        "header",
        "filters",
        "body",
        "collection",
        "create-action",
        "resource-action",
        "row-actions-view",
        "row-actions-edit",
        "row-actions-delete",
        "footer",
        "row-actions",
      ].includes(name),
  ),
);

const deleting = ref(false);
const exporting = ref(false);
const columnFields = computed(() =>
  resolveDisplayFields({ entries: surface.value.table.columns, labels: surface.value.table.labels, surface: "table" }),
);
const columnKeys = computed(() => columnFields.value.map((field) => field.key));
const tableNamespace = computed(() => surface.value.table.namespace);
const columnPreferences = useTablePreferences(
  tableNamespace,
  columnKeys,
  computed(() => surface.value.table.minColumnWidth ?? 96),
);
const columnSizing = ref<Record<string, number>>({
  ...columnPreferences.sizes.value,
});
watch(columnPreferences.sizes, (sizes) => {
  columnSizing.value = { ...sizes };
});

function setVisibleColumns(next: string[]) {
  const normalized = columnKeys.value.filter((key) => next.includes(key));
  const hasActions = Boolean(
    slots["row-actions"] ||
    surface.value.detailRoute ||
    surface.value.updateRoute ||
    surface.value.can,
  );
  if (!hasActions && normalized.length === 0 && columnKeys.value.length) return;
  columnPreferences.setVisible(normalized);
}

function setColumnSizing(next: Record<string, number>) {
  columnSizing.value = { ...next };
  columnPreferences.setSizes(next);
}

function resetColumns() {
  columnPreferences.resetColumns();
  columnSizing.value = {};
}

async function remove(
  record: TRecord,
  close: (value: boolean) => void,
) {
  if (deleting.value) return;
  deleting.value = true;
  try {
    await surface.value.deleteRecord?.(record);
    close(false);
    toast.success("Record deleted.");
  } catch {
    toast.error("Could not delete record.");
  } finally {
    deleting.value = false;
  }
}

async function exportRows() {
  if (props.export === false || exporting.value) return;
  exporting.value = true;
  try {
    const { page: _page, limit: _limit, ...activeQuery } = currentQuery.value;
    const columns = columnFields.value.filter((field) =>
      columnPreferences.visibleKeys.value.includes(field.key),
    );
    await exportTableRows({
      activeQuery: activeQuery as TQuery,
      searchParameters: surface.value.table.searchParameters ?? {},
      data: surface.value.table.data,
      load: surface.value.table.load,
      columns,
      options: props.export ?? {},
      fallbackNamespace: surface.value.table.namespace,
    });
    toast.success("Export created.");
  } catch (error) {
    toast.error("Could not create export.");
    emit("export-error", error);
  } finally {
    exporting.value = false;
  }
}

const canExport = computed(
  () =>
    props.export !== false &&
    Boolean(surface.value.table.data || surface.value.table.load),
);

const customActions = computed<ListViewActions<TRecord>>(() => ({
  createRoute: surface.value.createRoute,
  detailRoute: surface.value.detailRoute,
  updateRoute: surface.value.updateRoute,
  can: surface.value.can,
  deleteRecord: surface.value.deleteRecord,
}));
</script>

<template>
  <section class="is-list-view flex flex-col gap-2">
    <Card variant="outlined" color="surfaceContainer" class="gap-0 p-0">
      <header class="flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <slot name="header">
              <div class="min-w-0">
                <h1 v-if="title" class="text-lg font-semibold tracking-tight text-on-surface">
                  {{ title }}
                </h1>
                <p v-if="description" class="mt-1 text-sm text-on-surface-variant">
                  {{ description }}
                </p>
              </div>
            </slot>
            <div class="flex flex-wrap items-center gap-2">
              <SearchBox
                :model-value="String(currentQuery.search ?? '')"
                @update:model-value="
                  (search: string) =>
                    applyQuery({ search: search || undefined, page: 1 })
                "
              />
              <Popover v-if="filters">
                <template #trigger>
                  <Button kind="icon" variant="standard" ariaLabel="Filter">
                    <template #icon><Icon name="filter" /></template>
                  </Button>
                </template>
                <template #content>
                  <Form
                    ref="filterFormRef"
                    :fields="filters.fields"
                    :schema="filters.schema"
                    :labels="filters.labels"
                    :validators="filters.validators"
                    :model-value="filterDraft"
                    @update:model-value="updateFilters"
                  />
                  <Button
                    type="button"
                    variant="text"
                    @click="resetFilters"
                    >{{ filters.resetLabel ?? "Reset filter" }}</Button
                  >
                </template>
              </Popover>
              <Dialog>
                <template #trigger>
                  <Button kind="icon" variant="standard" ariaLabel="Columns">
                    <template #icon><Icon name="table" /></template>
                  </Button>
                </template>
                <template #title>Columns</template>
                <template #content>
                  <slot
                    name="column-dialog"
                    :columns="columnFields"
                    :reset="resetColumns"
                  >
                    <label
                      v-for="column in columnFields"
                      :key="column.key"
                      class="flex items-center justify-between gap-4"
                    >
                      <span>{{ column.label ?? column.key }}</span>
                      <Switch
                        :model-value="
                          columnPreferences.visibleKeys.value.includes(column.key)
                        "
                        @update:model-value="
                          (visible) =>
                            setVisibleColumns(
                              visible
                                ? [
                                    ...columnPreferences.visibleKeys.value,
                                    column.key,
                                  ]
                                : columnPreferences.visibleKeys.value.filter(
                                    (key) => key !== column.key,
                                  ),
                            )
                        "
                      />
                    </label>
                    <Button type="button" variant="text" @click="resetColumns"
                      >Reset columns</Button
                    >
                  </slot>
                </template>
              </Dialog>
              <slot
                name="export-controls"
                :export="exportRows"
                :exporting="exporting"
              >
                <Button
                  v-if="canExport"
                  kind="icon"
                  variant="standard"
                  ariaLabel="Export Excel"
                  :disabled="exporting"
                  @click="exportRows"
                >
                  <template #icon><Icon name="file-excel" /></template>
                </Button>
              </slot>
            </div>
          </div>
          <div v-if="surface.createRoute || $slots['resource-action']" class="flex flex-row justify-end gap-2">
            <template v-if="surface.createRoute">
              <slot name="create-action" v-bind="{ can: surface.can, target: surface.createRoute }">
                <RouterLink v-if="surface.can?.('create') ?? true" :to="surface.createRoute">
                  <Button>
                    <template #icon><Icon name="add" /></template>Create
                  </Button>
                </RouterLink>
              </slot>
            </template>
            <slot v-if="$slots['resource-action']" name="resource-action" />
          </div>
        </div>
      </header>

      <div
        v-if="$slots.filters"
        class="border-t border-outline-variant px-5 py-3 sm:px-6"
      >
        <slot name="filters" />
      </div>
    </Card>

    <Card variant="outlined" color="surfaceContainer" class="gap-0 p-0">
      <slot name="body" v-bind="{ table: surface.table }">
        <div class="p-3 sm:p-4">
          <Table
            ref="tableRef"
            v-bind="tableBindings"
            :namespace="surface.table.namespace ?? 'table'"
            :visible-columns="columnPreferences.visibleKeys.value"
            :column-sizing="columnSizing"
            @update:query="onTableQuery"
            @update:visible-columns="setVisibleColumns"
            @update:column-sizing="setColumnSizing"
            @row-reorder="rowReorder"
          >
            <template v-if="$slots.collection" #collection="collection">
              <slot name="collection" v-bind="{ ...collection, actions: customActions }" />
            </template>
            <template
              v-if="
                $slots['row-actions'] ||
                surface.detailRoute ||
                surface.updateRoute ||
                surface.can
              "
              #row-actions="{ record }"
            >
                  <div
                    class="flex items-center justify-end gap-1"
                    aria-label="Row actions"
                  >
                    <template v-if="surface.detailRoute?.(record)">
                      <slot name="row-actions-view" v-bind="{ record, can: surface.can, target: surface.detailRoute(record)! }">
                        <RouterLink
                          v-slot="{ href, navigate }"
                          custom
                          :to="surface.detailRoute(record)!"
                        >
                          <Button
                            kind="icon"
                            variant="standard"
                            :href="href"
                            ariaLabel="View"
                            @click.stop="navigate"
                          >
                            <template #icon><Icon name="eye" size="base" /></template>
                          </Button>
                        </RouterLink>
                      </slot>
                    </template>
                    <template v-if="surface.updateRoute?.(record)">
                      <slot name="row-actions-edit" v-bind="{ record, can: surface.can, target: surface.updateRoute(record)! }">
                        <RouterLink
                          v-slot="{ href, navigate }"
                          custom
                          :to="surface.updateRoute(record)!"
                        >
                          <Button
                            kind="icon"
                            variant="standard"
                            :href="href"
                            ariaLabel="Edit"
                            @click.stop="navigate"
                          >
                            <template #icon><Icon name="edit" size="base" /></template>
                          </Button>
                        </RouterLink>
                      </slot>
                    </template>
                    <template v-if="surface.can?.('delete', record)">
                      <slot
                        name="row-actions-delete"
                        v-bind="{ record, can: surface.can, deleteRecord: surface.deleteRecord }"
                      >
                        <Dialog v-if="surface.deleteRecord">
                          <template #trigger>
                            <Button
                              kind="icon"
                              variant="standard"
                              color="error"
                              ariaLabel="Delete"
                              @click.stop
                            >
                              <template #icon><Icon name="delete-bin" size="base" /></template>
                            </Button>
                          </template>
                          <template #title>Delete record?</template>
                          <template #description>This action cannot be undone.</template>
                          <template #footer="{ setOpen }">
                            <div class="flex w-full justify-end gap-2">
                              <Button
                                type="button"
                                variant="text"
                                :disabled="deleting"
                                @click="setOpen(false)"
                              >Cancel</Button>
                              <Button
                                type="button"
                                color="error"
                                :disabled="deleting"
                                @click="remove(record, setOpen)"
                              >Delete</Button>
                            </div>
                          </template>
                        </Dialog>
                      </slot>
                    </template>
                    <slot name="row-actions" v-bind="{ record }" />
                  </div>
                </template>
                <template
                  v-for="([name], index) in passthroughSlots"
                  #[name]="slotProps"
                  :key="index"
                >
                  <slot :name="name" v-bind="slotProps ?? {}" />
                </template>
          </Table>
        </div>
      </slot>

      <footer
        v-if="$slots.footer"
        class="border-t border-outline-variant px-5 py-3"
      >
        <slot name="footer" />
      </footer>
    </Card>
  </section>
</template>
