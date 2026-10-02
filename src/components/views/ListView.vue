<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TFilterInput extends object = Partial<TQuery>">
/**
 * Collection surface shell.
 *
 * Owns Card, page title, toolbar, filters, and the selected collection
 * presentation. Collection owns the one data lifecycle for the body.
 */
import { computed, nextTick, reactive, ref, useSlots, watch } from "vue";
import { toast } from "vue-sonner";
import type {
  CollectionSlotProps,
  FormDraft,
  QueryValues,
  RecordIdentity,
  RowReorderPayload,
  SchemaParseResult,
  SubmitError,
  TableProps,
} from "../../contracts";
import type { FormDraftSnapshot } from "../../contracts/forms";
import type { ListViewActions, ListViewDeleteState, ListViewProps, ListViewSlotActions } from "../../contracts/views";
import type { RouteLocationRaw } from "vue-router";
import { useFrameworkAdapters } from "../../adapters/projectAdapters";
import { resolveDisplayFields } from "../../display/resolveDisplay";
import { coerceQueryValues, stableValue } from "../../query";
import { checkIdentityValue } from "../../resources/identity";
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
const adapters = useFrameworkAdapters();
const emit = defineEmits<{
  (event: "update:query", query: QueryValues): void;
  (event: "export-error", error: unknown): void;
  (event: "row-reorder", payload: RowReorderPayload<TRecord>): void;
}>();
const slots = useSlots();
defineSlots<{
  [name: `cell:${string}`]: (props: { value: unknown; record: TRecord; field: unknown; index: number }) => unknown;
  collection?: (props: CollectionSlotProps<TRecord, TQuery> & { actions?: ListViewSlotActions<TRecord> }) => unknown;
  /**
   * Per-standard-action overrides. The framework owns visibility: each region
   * renders only when its action is declared and permitted, so custom content
   * never needs its own permission checks. Props are for nuance only.
   */
  "row-actions-view"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-edit"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "row-actions-delete"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; deleteRecord?: ListViewSlotActions<TRecord>["deleteRecord"]; deleteState: ListViewDeleteState }) => unknown;
  "create-action"?: (props: { can?: ListViewActions<TRecord>["can"]; target: import("vue-router").RouteLocationRaw }) => unknown;
  "resource-action"?: () => unknown;
  header?: () => unknown;
  filters?: () => unknown;
  body?: (props: { table: TableProps<TRecord, TQuery> }) => unknown;
  footer?: () => unknown;
  "row-actions"?: (props: { record: TRecord }) => unknown;
}>();

type DeleteOwner = string | NonNullable<ListViewActions<TRecord>["recordIdentity"]>;
type DeleteBinding = {
  owner: DeleteOwner;
  key: string;
  identity: NonNullable<ListViewActions<TRecord>["recordIdentity"]>;
  deleteRecord: NonNullable<ListViewActions<TRecord>["deleteRecord"]>;
};
type DeleteOutcome = { pending: boolean; error?: Readonly<SubmitError> };

const staleDeleteCompletionKey = Symbol();
const identityOwnerTokens = new WeakMap<NonNullable<ListViewActions<TRecord>["recordIdentity"]>, number>();
let nextIdentityOwnerToken = 0;

type ListViewSurface = {
  table: TableProps<TRecord, TQuery>;
  createRoute?: RouteLocationRaw;
  detailRoute?: (record: TRecord) => RouteLocationRaw | undefined;
  updateRoute?: (record: TRecord) => RouteLocationRaw | undefined;
  can?: ListViewActions<TRecord>["can"];
  deleteRecord?: ListViewActions<TRecord>["deleteRecord"];
  recordIdentity?: ListViewActions<TRecord>["recordIdentity"];
};

const surface = computed<ListViewSurface>(() => {
  if (props.deleteRecord !== undefined && typeof props.deleteRecord !== "function") {
    throw new Error("[loom][SURFACE_OPTION_INVALID] ListView deleteRecord must be a function.");
  }
  if (props.deleteRecord && typeof props.recordIdentity !== "function") {
    throw new Error("[loom][SURFACE_OPTION_INVALID] ListView deleteRecord requires recordIdentity.");
  }
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
    recordIdentity: props.recordIdentity,
  };
});

const tableRef = ref<{ refresh: () => Promise<void>; query: QueryValues; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void }>();
const currentQuery = computed<QueryValues>(() => (props.table.query as QueryValues | undefined)
  ?? tableRef.value?.query
  ?? { page: 1, limit: props.table.defaultPageSize ?? 10 });
declaredFilterQueryKeys();
const filterDraftState = ref<FormDraft<TFilterInput>>(filterDraftFromQuery(currentQuery.value));
const filterDraft = computed(() => filterDraftState.value);
const filterFormRef = ref<{ draft: FormDraftSnapshot<TFilterInput>; validate: () => Promise<SchemaParseResult<Partial<TQuery>>>; reset: () => void }>();
let filterValidation = 0;
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

function sameDraftValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameDraftValue(value, right[index]));
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  const leftPrototype = Object.getPrototypeOf(left);
  const rightPrototype = Object.getPrototypeOf(right);
  if (leftPrototype !== rightPrototype || (leftPrototype !== Object.prototype && leftPrototype !== null)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameDraftValue(Reflect.get(left, key), Reflect.get(right, key)));
}

watch(currentQuery, (values) => {
  filterValidation += 1;
  if (pendingFilterQuery && sameQuery(values, pendingFilterQuery)) {
    pendingFilterQuery = undefined;
    return;
  }
  pendingFilterQuery = undefined;
  filterDraftState.value = filterDraftFromQuery(values);
}, { deep: true });

function filterDraftFromQuery(query: Readonly<QueryValues>): FormDraft<TFilterInput> {
  return { ...(props.filters?.defaults ?? {}), ...(props.filters?.toDraft(query) ?? {}) };
}

function declaredFilterQueryKeys(): Set<string> {
  const keys = new Set<string>(props.filters?.queryKeys ?? []);
  if (keys.has("page")) {
    throw new Error("[loom][SURFACE_OPTION_INVALID] filters.queryKeys cannot include the reserved ListView query key \"page\".");
  }
  return keys;
}

function rowReorder(payload: RowReorderPayload<TRecord>) {
  emit("row-reorder", payload);
}

async function updateFilters(next: FormDraftSnapshot<TFilterInput>) {
  if (sameDraftValue(filterDraftState.value, next)) return;
  filterDraftState.value = { ...next };
  await validateAndCommitFilters();
}

async function validateAndCommitFilters() {
  const validation = ++filterValidation;
  await nextTick();
  if (validation !== filterValidation) return;
  const result = await filterFormRef.value?.validate();
  if (!result?.success || validation !== filterValidation) return;

  const queryKeys = declaredFilterQueryKeys();
  const undeclaredKey = Object.keys(result.data).find((key) => !queryKeys.has(key));
  if (undeclaredKey) {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] ListView filter output key "${undeclaredKey}" is not declared in filters.queryKeys.`);
  }

  const query = { ...currentQuery.value };
  for (const key of queryKeys) delete query[key];
  for (const [key, value] of Object.entries(result.data)) {
    if (value !== undefined) query[key] = value;
  }
  query.page = 1;
  pendingFilterQuery = coerceQueryValues(query, { page: 1, limit: props.table.defaultPageSize ?? 10 });
  tableRef.value?.replaceQuery(query);
}

async function resetFilters() {
  const form = filterFormRef.value;
  if (!form) return;
  form.reset();
  filterDraftState.value = { ...form.draft };
  await validateAndCommitFilters();
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

const deleteOutcomes = reactive(new Map<DeleteOwner, Map<string, DeleteOutcome>>());
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

function deleteBinding(record: TRecord): DeleteBinding | undefined {
  const identity = surface.value.recordIdentity;
  const deleteRecord = surface.value.deleteRecord;
  if (!identity || !deleteRecord) return undefined;
  const owner = surface.value.table.resource ?? identity;
  const value = identity(record);
  checkIdentityValue(typeof owner === "string" ? owner : "ListView", "delete", value);
  const key = JSON.stringify(stableValue(value));
  if (key === undefined) throw new Error("[loom][RESOURCE_IDENTITY_INVALID] ListView delete identity cannot be encoded.");
  return { owner, key, identity, deleteRecord };
}

function deleteOutcome(binding: DeleteBinding): DeleteOutcome | undefined {
  return deleteOutcomes.get(binding.owner)?.get(binding.key);
}

function deleteDialogKey(record: TRecord): string {
  const binding = deleteBinding(record);
  if (!binding) return "delete-unavailable";
  if (typeof binding.owner === "string") return JSON.stringify(["resource", binding.owner, binding.key]);
  let token = identityOwnerTokens.get(binding.owner);
  if (token === undefined) {
    token = ++nextIdentityOwnerToken;
    identityOwnerTokens.set(binding.owner, token);
  }
  return JSON.stringify(["identity", token, binding.key]);
}

function setDeleteOutcome(binding: DeleteBinding, outcome: DeleteOutcome | undefined) {
  const ownerOutcomes = deleteOutcomes.get(binding.owner);
  if (!outcome) {
    ownerOutcomes?.delete(binding.key);
    if (ownerOutcomes?.size === 0) deleteOutcomes.delete(binding.owner);
    return;
  }
  const nextOwnerOutcomes = ownerOutcomes ?? new Map<string, DeleteOutcome>();
  if (!ownerOutcomes) deleteOutcomes.set(binding.owner, nextOwnerOutcomes);
  nextOwnerOutcomes.set(binding.key, outcome);
}

function getDeleteState(record: TRecord): ListViewDeleteState {
  const binding = deleteBinding(record);
  const outcome = binding ? deleteOutcome(binding) : undefined;
  return {
    disabled: Boolean(outcome?.pending || outcome?.error),
    pending: Boolean(outcome?.pending),
    ...(outcome?.error ? { error: outcome.error } : {}),
  };
}

function deleteBindingIsCurrent(binding: DeleteBinding): boolean {
  const current = surface.value;
  return current.recordIdentity === binding.identity
    && current.deleteRecord === binding.deleteRecord
    && (current.table.resource ?? current.recordIdentity) === binding.owner;
}

function staleDeleteCompletion(): Error {
  const error = new Error("Delete completed after the list changed.");
  Object.defineProperty(error, staleDeleteCompletionKey, { value: true });
  return error;
}

function isStaleDeleteCompletion(error: unknown): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, staleDeleteCompletionKey) === true;
}

async function performDelete(record: TRecord, binding: DeleteBinding): Promise<unknown> {
  const existing = deleteOutcome(binding);
  if (existing?.error) throw existing.error;
  if (existing?.pending) throw new Error("A delete request is already in progress.");
  setDeleteOutcome(binding, { pending: true });
  try {
    const result = await binding.deleteRecord(record);
    setDeleteOutcome(binding, undefined);
    if (!deleteBindingIsCurrent(binding)) throw staleDeleteCompletion();
    return result;
  } catch (error) {
    if (isStaleDeleteCompletion(error)) throw error;
    const normalized = adapters.data.normalizeError(error);
    if (normalized.postWrite) {
      setDeleteOutcome(binding, { pending: false, error: Object.freeze(normalized) });
    } else {
      setDeleteOutcome(binding, undefined);
    }
    throw normalized;
  }
}

async function guardedDelete(record: TRecord): Promise<unknown> {
  const binding = deleteBinding(record);
  if (!binding) throw new Error("ListView has no delete action.");
  return performDelete(record, binding);
}

async function remove(record: TRecord, close: (value: boolean) => void) {
  const binding = deleteBinding(record);
  if (!binding) return;
  try {
    await performDelete(record, binding);
    close(false);
    toast.success("Record deleted.");
  } catch (error) {
    if (isStaleDeleteCompletion(error)) return;
    const normalized = adapters.data.normalizeError(error);
    if (!normalized.postWrite) toast.error(normalized.message);
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

const customActions = computed<ListViewSlotActions<TRecord>>(() => ({
  createRoute: surface.value.createRoute,
  detailRoute: surface.value.detailRoute,
  updateRoute: surface.value.updateRoute,
  can: surface.value.can,
  deleteRecord: surface.value.deleteRecord ? guardedDelete : undefined,
  deleteState: getDeleteState,
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
            <template v-if="surface.createRoute && (surface.can?.('create') ?? true)">
              <slot name="create-action" v-bind="{ can: surface.can, target: surface.createRoute }">
                <RouterLink :to="surface.createRoute">
                  <Button>
                    <template #icon><Icon name="add" /></template>{{ props.actionLabels?.create ?? 'Create' }}
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
                    <template v-if="surface.detailRoute?.(record) && (surface.can?.('detail', record) ?? true)">
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
                            :ariaLabel="props.actionLabels?.view ?? 'View'"
                            @click.stop="navigate"
                          >
                            <template #icon><Icon name="eye" size="base" /></template>
                          </Button>
                        </RouterLink>
                      </slot>
                    </template>
                    <template v-if="surface.updateRoute?.(record) && (surface.can?.('update', record) ?? true)">
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
                            :ariaLabel="props.actionLabels?.edit ?? 'Edit'"
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
                        v-bind="{ record, can: surface.can, deleteRecord: customActions.deleteRecord, deleteState: getDeleteState(record) }"
                      >
                        <div v-if="getDeleteState(record).error" role="alert" class="max-w-64 whitespace-normal text-xs text-error">
                          <p>The delete may have completed. Check the record before trying again.</p>
                          <p>{{ getDeleteState(record).error?.message }}</p>
                        </div>
                        <Dialog v-if="surface.deleteRecord" :key="deleteDialogKey(record)">
                          <template #trigger>
                            <Button
                              kind="icon"
                              variant="standard"
                              color="error"
                              :ariaLabel="props.actionLabels?.delete ?? 'Delete'"
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
                                :disabled="getDeleteState(record).pending"
                                @click="setOpen(false)"
                              >Cancel</Button>
                              <Button
                                type="button"
                                color="error"
                                :disabled="getDeleteState(record).disabled"
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
