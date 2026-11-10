<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TFilterInput extends object = Partial<TQuery>, TContext extends object = Readonly<Record<string, unknown>>">
/**
 * Collection surface shell.
 *
 * Owns Card, page title, toolbar, filters, and the selected collection
 * presentation. Collection owns the one data lifecycle for the body.
 */
import { callWithAsyncErrorHandling, ErrorCodes, getCurrentInstance, computed, nextTick, onBeforeUnmount, reactive, ref, toRaw, useSlots, watch } from "vue";
import { isCancelledError } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import type {
  CollectionSlotProps,
  FormDraft,
  QueryValues,
  RecordIdentity,
  RowReorderPayload,
  SchemaParseResult,
  SchemaIssue,
  SubmitError,
  TableProps,
} from "../../contracts";
import type { FormDraftSnapshot } from "../../contracts/forms";
import type { ListViewActions, ListViewDeleteState, ListViewProps, ListViewSlotActions, RouteTarget } from "../../contracts/views";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { useFrameworkAdapters } from "../../adapters/projectAdapters";
import { resolveDisplayFields } from "../../display/resolveDisplay";
import { coerceQueryValues, stableValue } from "../../query";
import { checkIdentityValue } from "../../resources/identity";
import Table from "../core/Table.vue";
import FormRendering from "../core/FormRendering.vue";
import { useFormSession } from "../../forms/useFormSession";
import type { FormProps } from "../../forms/props";
import Button from "../base/Button.vue";
import Card from "../base/Card.vue";
import Dialog from "../base/Dialog.vue";
import Icon from "../base/Icon.vue";
import Popover from "../base/Popover.vue";
import SearchBox from "../inputs/SearchBox.vue";
import Switch from "../inputs/Switch.vue";
import Menu from "../base/Menu.vue";
import { defaultExportStyles } from '../../exports/defaultStyles';
import { useExport } from '../../exports/useExport';
import { composeSourceGuards } from '../../resources/sourceGuard';
import { collectExportRows } from '../../exports/collectRows';
import { resolveExportFields } from '../../exports/resolveExportFields'
import { inheritExportConfiguration } from '../../exports/inheritConfiguration'
import { createExportSnapshot } from '../../exports/document';
import type { ExportControls } from '../../exports/contracts';
import ExportPreview from '../../exports/ExportPreview.vue';
import { useTablePreferences } from "../core/useTablePreferences";
import { isConfirmedWriteRefreshError, normalizeWriteError } from "../../resources/postWriteOutcome";
import { withCurrentQuery } from "./routeQuery";

const props = defineProps<ListViewProps<TRecord, TQuery, TFilterInput, TContext>>();
const router = useRouter();
const instance = getCurrentInstance();
const adapters = useFrameworkAdapters();
const emit = defineEmits<{
  (event: "update:query", query: QueryValues): void;
  (event: "export-error", error: unknown): void;
  (event: "row-reorder", payload: RowReorderPayload<TRecord>): void;
}>();
const slots = useSlots();
defineSlots<{
  [name: `cell:${string}`]: (props: { value: unknown; record: TRecord; field: unknown; index: number }) => unknown;
  collection?: (props: CollectionSlotProps<TRecord, TQuery> & { actions?: ListViewSlotActions<TRecord>; exportControls: ExportControls }) => unknown;
  /**
   * Per-standard-action overrides. The framework owns visibility: each region
   * renders only when its action is declared and permitted, so custom content
   * never needs its own permission checks. Props are for nuance only.
   */
  "row-actions-view"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: RouteTarget }) => unknown;
  "row-actions-edit"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; target: RouteTarget }) => unknown;
  "row-actions-delete"?: (props: { record: TRecord; can?: ListViewActions<TRecord>["can"]; deleteRecord?: ListViewSlotActions<TRecord>["deleteRecord"]; deleteState: ListViewDeleteState }) => unknown;
  "create-action"?: (props: { can?: ListViewActions<TRecord>["can"]; target: RouteTarget }) => unknown;
  "resource-action"?: (props: { exportControls: ExportControls }) => unknown;
  "export-action"?: (props: { exportControls: ExportControls }) => unknown;
  header?: (props: { exportControls: ExportControls }) => unknown;
  empty?: () => unknown;
  filters?: (props: FilterSlotProps) => unknown;
  context?: (props: ListViewContextSlotProps) => unknown;
  toolbar?: (props: { exportControls: ExportControls } & FilterSlotProps) => unknown;
  body?: (props: { table: TableProps<TRecord, TQuery, TContext>; exportControls: ExportControls }) => unknown;
  footer?: (props: { exportControls: ExportControls }) => unknown;
  "row-actions"?: (props: { record: TRecord }) => unknown;
}>();

type DeleteOwner = string | NonNullable<ListViewActions<TRecord>["recordIdentity"]>;
type FilterSlotProps = {
  draft: FormDraftSnapshot<TFilterInput>;
  issues: readonly SchemaIssue[];
  validating: boolean;
  setValue: <K extends Extract<keyof TFilterInput, string>>(key: K, value: TFilterInput[K]) => void;
  validate: () => Promise<SchemaParseResult<Partial<TQuery>> | undefined>;
  reset: () => Promise<void>;
  setError: (key: Extract<keyof TFilterInput, string>, message: string | undefined) => void;
  errorFor: (key: Extract<keyof TFilterInput, string>) => string | undefined;
  touched: (key: Extract<keyof TFilterInput, string>) => boolean;
  touch: (key: Extract<keyof TFilterInput, string>) => void;
};
type ListViewContextSlotProps = FilterSlotProps & Pick<CollectionSlotProps<TRecord, TQuery>, "context" | "loading" | "error"> & { query: QueryValues };
type DeleteBinding = {
  owner: DeleteOwner;
  key: string;
  identity: NonNullable<ListViewActions<TRecord>["recordIdentity"]>;
  deleteRecord: NonNullable<ListViewActions<TRecord>["deleteRecord"]>;
};
type DeleteOutcome = { pending: boolean; refreshing?: boolean; error?: Readonly<SubmitError> };

const staleDeleteCompletionKey = Symbol();
const identityOwnerTokens = new WeakMap<NonNullable<ListViewActions<TRecord>["recordIdentity"]>, number>();
let nextIdentityOwnerToken = 0;

type ListViewSurface = {
  table: TableProps<TRecord, TQuery, TContext>;
  createRoute?: RouteTarget;
  detailRoute?: (record: TRecord) => RouteTarget | undefined;
  updateRoute?: (record: TRecord) => RouteTarget | undefined;
  can?: ListViewActions<TRecord>["can"];
  deleteRecord?: ListViewActions<TRecord>["deleteRecord"];
  recordIdentity?: ListViewActions<TRecord>["recordIdentity"];
};

function withCurrentQueryIfPresent(target: RouteTarget | undefined): RouteTarget | undefined {
  return target === undefined ? undefined : withCurrentQuery(target, router.currentRoute.value.query, router);
}

const surface = computed<ListViewSurface>(() => {
  if (props.deleteRecord !== undefined && typeof props.deleteRecord !== "function") {
    throw new Error("[loom][SURFACE_OPTION_INVALID] ListView deleteRecord must be a function.");
  }
  if (props.deleteRecord && typeof props.recordIdentity !== "function") {
    throw new Error("[loom][SURFACE_OPTION_INVALID] ListView deleteRecord requires recordIdentity.");
  }
  const createRoute = props.createRoute === false ? undefined : props.createRoute;
  const detailRoute = props.detailRoute === false ? undefined : props.detailRoute;
  const updateRoute = props.updateRoute === false ? undefined : props.updateRoute;
  return {
    table: {
      ...props.table,
      pagination: props.table.pagination ?? "always",
    },
    createRoute: withCurrentQueryIfPresent(createRoute),
    detailRoute: detailRoute ? (record) => withCurrentQueryIfPresent(detailRoute(record)) : undefined,
    updateRoute: updateRoute ? (record) => withCurrentQueryIfPresent(updateRoute(record)) : undefined,
    can: props.can,
    deleteRecord: props.deleteRecord,
    recordIdentity: props.recordIdentity,
  };
});

const tableRef = ref<Pick<CollectionSlotProps<TRecord, TQuery>, "context" | "loading" | "error"> & { refresh: () => Promise<void>; query: QueryValues; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void; readReady: boolean }>();
const currentQuery = computed<QueryValues>(() => (props.table.query as QueryValues | undefined)
  ?? tableRef.value?.query
  ?? { page: 1, limit: props.table.defaultPageSize ?? 10 });
const contextSlotProps = computed<ListViewContextSlotProps>(() => ({
  context: tableRef.value?.context,
  loading: tableRef.value?.loading ?? Boolean(surface.value.table.load && !slots.body),
  error: tableRef.value?.error,
  query: currentQuery.value,
  ...filterSlotProps.value,
}));
declaredFilterQueryKeys();
const filterDraftState = ref<FormDraft<TFilterInput>>(filterDraftFromQuery(currentQuery.value));
const filterConfiguration = computed<FormProps<TFilterInput, Partial<TQuery>, never, Extract<keyof TFilterInput, string>, TContext>>(() => ({
  ...props.filters!,
  context: surface.value.table.context,
  modelValue: filterDraftState.value,
}));
const filterSession = props.filters ? useFormSession(new Proxy(filterConfiguration.value, {
  get: (_target, key) => Reflect.get(filterConfiguration.value, key),
}), {
  updateModel: (next) => { callWithAsyncErrorHandling(updateFilters, instance, ErrorCodes.COMPONENT_EVENT_HANDLER, [next]); },
  submitted: () => {}, error: () => {}, reset: () => {},
}, { modelValuePresent: true }) : undefined;
const filterSlotProps = computed<FilterSlotProps>(() => ({
  draft: filterSession?.draft.value ?? filterDraftState.value,
  issues: filterSession?.issues.value ?? [],
  validating: filterSession?.validating.value ?? false,
  setValue: (key, value) => filterSession?.setValue(key, value),
  validate: async () => filterSession?.validate(),
  reset: resetFilters,
  setError: (key, message) => filterSession?.setControlError(key, message),
  errorFor: (key) => filterSession?.issueFor(key),
  touched: (key) => filterSession?.touchedField(key) ?? false,
  touch: (key) => filterSession?.touch(key),
}));
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
  const result = await filterSession?.validate();
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
  if (!filterSession) return;
  filterSession.reset();
  filterDraftState.value = { ...filterSession.draft.value };
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
        "export-action",
        "row-actions-view",
        "row-actions-edit",
        "row-actions-delete",
        "footer",
        "row-actions",
        "context",
        "toolbar",
      ].includes(name),
  ),
);

const deleteOutcomes = reactive(new Map<DeleteOwner, Map<string, DeleteOutcome>>());

let mounted = true;
const columnFields = computed(() =>
  resolveDisplayFields({ entries: surface.value.table.columns, labels: surface.value.table.labels, context: surface.value.table.context, surface: "table" }),
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
  const currentSurface = surface.value;
  const identity = currentSurface.recordIdentity;
  const deleteRecord = currentSurface.deleteRecord;
  if (!identity || !deleteRecord) return undefined;
  const owner = currentSurface.table.resource ?? identity;
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

function ownsDeleteOutcome(binding: DeleteBinding, outcome: DeleteOutcome): boolean {
  const current = deleteOutcome(binding);
  return current !== undefined && toRaw(current) === outcome;
}

function getDeleteState(record: TRecord): ListViewDeleteState {
  const binding = deleteBinding(record);
  const outcome = binding ? deleteOutcome(binding) : undefined;
  const error = outcome?.error;
  return {
    disabled: Boolean(outcome?.pending || outcome?.error),
    pending: Boolean(outcome?.pending),
    ...(error ? { error } : {}),
    ...(outcome?.refreshing ? { refreshing: true } : {}),
    ...(binding && error && isConfirmedWriteRefreshError(error) ? { refresh: () => refreshDelete(binding, error) } : {}),
  };
}

function deleteRecoveryIsCurrent(binding: DeleteBinding, error: Readonly<SubmitError>): boolean {
  const outcome = deleteOutcome(binding);
  const current = surface.value;
  return mounted
    && current.recordIdentity === binding.identity
    && (current.table.resource ?? current.recordIdentity) === binding.owner
    && outcome?.error === error;
}

async function refreshDelete(binding: DeleteBinding, error: Readonly<SubmitError>): Promise<void> {
  if (!isConfirmedWriteRefreshError(error)) return;
  const outcome = deleteOutcome(binding);
  if (!deleteRecoveryIsCurrent(binding, error) || outcome?.refreshing || outcome?.pending) return;
  setDeleteOutcome(binding, { pending: false, refreshing: true, error });
  try {
    await error.refresh();
    if (deleteRecoveryIsCurrent(binding, error)) setDeleteOutcome(binding, undefined);
    else resetDeleteRecovery(binding, error);
  } catch (recoveryError) {
    const currentRead = tableRef.value;
    if (isCancelledError(recoveryError) && deleteRecoveryIsCurrent(binding, error) && currentRead?.readReady) {
      setDeleteOutcome(binding, undefined);
      return;
    }
    if (resetDeleteRecovery(binding, error) && deleteBindingIsCurrent(binding) && !isCancelledError(recoveryError)) {
      toast.warning("Changes saved. Could not refresh the data.");
    }
  }
}

function resetDeleteRecovery(binding: DeleteBinding, error: Readonly<SubmitError>): boolean {
  const outcome = deleteOutcome(binding);
  if (!mounted || outcome?.error !== error) return false;
  setDeleteOutcome(binding, { pending: false, refreshing: false, error });
  return true;
}

function deleteBindingIsCurrent(binding: DeleteBinding): boolean {
  const current = surface.value;
  return mounted
    && current.recordIdentity === binding.identity
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
  const pendingOutcome: DeleteOutcome = { pending: true };
  setDeleteOutcome(binding, pendingOutcome);
  try {
    const result = await binding.deleteRecord(record);
    if (!mounted || !ownsDeleteOutcome(binding, pendingOutcome)) throw staleDeleteCompletion();
    setDeleteOutcome(binding, undefined);
    if (!deleteBindingIsCurrent(binding)) throw staleDeleteCompletion();
    return result;
  } catch (error) {
    if (isStaleDeleteCompletion(error)) throw error;
    const normalized = normalizeWriteError(error, adapters.data.normalizeError);
    const ownsPendingOutcome = ownsDeleteOutcome(binding, pendingOutcome);
    if (mounted && ownsPendingOutcome) {
      setDeleteOutcome(binding, normalized.postWrite
        ? { pending: false, error: Object.freeze(normalized) }
        : undefined);
    }
    if (!mounted || !deleteBindingIsCurrent(binding) || !ownsPendingOutcome) throw staleDeleteCompletion();
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
  const outcome = deleteOutcome(binding);
  if (outcome?.pending || outcome?.error) return;
  try {
    await performDelete(record, binding);
    if (!deleteBindingIsCurrent(binding)) return;
    close(false);
    toast.success("Record deleted.");
  } catch (error) {
    if (isStaleDeleteCompletion(error) || !deleteBindingIsCurrent(binding)) return;
    const normalized = normalizeWriteError(error, adapters.data.normalizeError);
    if (isConfirmedWriteRefreshError(normalized)) {
      close(false);
      toast.warning("Changes saved. Could not refresh the data.");
    } else if (!normalized.postWrite) toast.error(normalized.message);
  }
}

onBeforeUnmount(() => {
  mounted = false;
});

const exportConfiguration = computed(() => {
  const configuration = typeof props.export === 'object' ? props.export : {};
  const { page: _page, limit: _limit, ...query } = currentQuery.value;
  const filename = typeof configuration.filename === 'function' ? configuration.filename({ query: query as TQuery }) : configuration.filename;
  return { ...configuration, filename: filename ?? `${surface.value.table.namespace ?? 'export'}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '-'), orientation: configuration.orientation ?? 'landscape' as const, styles: configuration.styles ?? (configuration.component ? undefined : defaultExportStyles) };
});
const exportState = useExport({
  available: () => props.export !== false && (props.exportAccess?.() ?? true) && Boolean(surface.value.table.data || surface.value.table.load),
  source: () => [surface.value.table, currentQuery.value, props.export, columnPreferences.visibleKeys.value],
  configuration: exportConfiguration,
  async prepare(signal) {
    const source = surface.value.table;
    const patch = exportConfiguration.value.table;
    const configuration = inheritExportConfiguration(source, patch);
    if (patch?.load && patch.load !== source.load && !source.sourceGuard) throw new Error('[loom] Export loader must be installed on the effective view source so its access and scope guards are preserved.');
    const changesQuery = patch?.query && Object.entries(patch.query).some(([key, value]) => JSON.stringify(stableValue(value)) !== JSON.stringify(stableValue(Reflect.get(currentQuery.value, key))));
    const changesData = patch?.data !== undefined && patch.data !== source.data;
    if ((changesQuery || changesData) && !source.sourceGuard) throw new Error('[loom] Export source overrides require the effective sourceGuard.');
    const sourceGuard = source.sourceGuard && patch?.sourceGuard ? composeSourceGuards(source.sourceGuard, patch.sourceGuard) : source.sourceGuard ?? patch?.sourceGuard;
    const query = { ...currentQuery.value, ...patch?.query } as TQuery;
    let exportData: readonly TRecord[] | undefined;
    if (exportConfiguration.value.load) {
      if (!source.sourceGuard) throw new Error('[loom] An alternate export loader requires the effective sourceGuard.');
      const activeQuery = Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'page' && key !== 'limit'));
      const loadContext = { query: activeQuery as TQuery, searchParameters: { ...patch?.searchParameters, ...source.searchParameters }, signal };
      sourceGuard?.beforeLoad(loadContext);
      const loaded = await exportConfiguration.value.load(loadContext);
      signal.throwIfAborted();
      exportData = Array.isArray(loaded) ? loaded : loaded.data;
    }
    const rows = await collectExportRows({ data: exportData ?? (patch?.load ? undefined : patch?.data ?? source.data), load: patch?.load ?? source.load, sourceGuard, pageSize: exportConfiguration.value.pageSize ?? configuration.defaultPageSize ?? (typeof currentQuery.value.limit === 'number' ? currentQuery.value.limit : undefined), querySchema: configuration.querySchema, query, searchParameters: { ...patch?.searchParameters, ...source.searchParameters }, signal });
    const context = configuration.context ?? ({} as TContext);
    const fields = resolveExportFields<TRecord, TContext>({ entries: configuration.columns, labels: configuration.labels, context, surface: 'table' }).filter(field => patch?.columns !== undefined || columnPreferences.visibleKeys.value.includes(field.key));
    if (!fields.length) throw new Error('[loom] Export requires one visible column.');
    return createExportSnapshot({ sheetName: (exportConfiguration.value.sheetName ?? 'Data').slice(0, 31), mapValue: exportConfiguration.value.mapValue, kind: 'table', title: exportConfiguration.value.title ?? props.title, rows, context, config: configuration, fields: () => fields });
  },
});
const exportControls = exportState.controls;
watch(() => exportControls.value.error, error => { if (error) emit("export-error", error); });
const exportMenuItems = computed(() => [
  ...(exportControls.value.formats.includes('pdf') ? [{ name: 'Ekspor sebagai PDF', action: exportControls.value.printPdf }] : []),
  ...(exportControls.value.formats.includes('xlsx') ? [{ name: 'Ekspor sebagai XLSX', action: exportControls.value.openPreview }] : []),
]);

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
            <slot name="header" :export-controls="exportControls">
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
                  <FormRendering
                    v-if="filterSession"
                    :configuration="filterConfiguration"
                    :session="filterSession"
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
              <slot v-if="exportControls.available" name="export-action" :export-controls="exportControls">
                <Menu :items="exportMenuItems" :disabled="exportControls.disabled">
                  <template #trigger>
                    <Button type="button" kind="icon" variant="standard" ariaLabel="Ekspor" :disabled="exportControls.disabled">
                      <template #icon><Icon name="download" size="base" /></template>
                    </Button>
                  </template>
                </Menu>
              </slot>
              <slot name="toolbar" :export-controls="exportControls" v-bind="filterSlotProps" />
              <p v-if="exportControls.error" role="alert">{{ exportControls.error.message }}</p>
            </div>
          </div>
          <div v-if="surface.createRoute || $slots['resource-action']" class="flex flex-row justify-end gap-2">
            <template v-if="surface.createRoute && (surface.can?.('create') ?? true)">
              <slot name="create-action" v-bind="{ can: surface.can, target: surface.createRoute }">
                <RouterLink :to="surface.createRoute as RouteLocationRaw">
                  <Button>
                    <template #icon><Icon name="add" /></template>{{ props.actionLabels?.create ?? 'Create' }}
                  </Button>
                </RouterLink>
              </slot>
            </template>
            <slot v-if="$slots['resource-action']" name="resource-action" :export-controls="exportControls" />
          </div>
        </div>
      </header>

      <div
        v-if="$slots.filters"
        class="border-t border-outline-variant px-5 py-3 sm:px-6"
      >
        <slot name="filters" v-bind="filterSlotProps" />
      </div>
    </Card>

    <slot name="context" v-bind="contextSlotProps" />

    <Card variant="outlined" color="surfaceContainer" class="gap-0 p-0">
      <slot name="body" v-bind="{ table: surface.table, exportControls }">
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
              <slot name="collection" v-bind="{ ...collection, actions: customActions, exportControls }" />
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
                          :to="surface.detailRoute(record)! as RouteLocationRaw"
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
                          :to="surface.updateRoute(record)! as RouteLocationRaw"
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
                          <p v-if="isConfirmedWriteRefreshError(getDeleteState(record).error)">Changes saved. The record list could not be refreshed.</p>
                          <p v-else>The delete may have completed. Check the record before trying again.</p>
                          <p>{{ getDeleteState(record).error?.message }}</p>
                          <Button
                            v-if="getDeleteState(record).refresh"
                            type="button"
                            variant="text"
                            class="min-w-0 px-2"
                            :disabled="getDeleteState(record).refreshing"
                            @click.stop="getDeleteState(record).refresh?.()"
                          >Retry refresh</Button>
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
        <slot name="footer" :export-controls="exportControls" />
      </footer>
    </Card>
  </section>
  <ExportPreview v-model="exportState.open.value" v-model:target="exportState.target.value" :snapshot="exportState.snapshot.value" :document-target="exportState.documentTarget.value" :configuration="exportState.configuration.value" :controls="exportControls" :output-formats="['xlsx']" @error="exportState.reportError" />
</template>
