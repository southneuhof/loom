/**
 * Canonical migration contracts: types only, no behavior, no Vue or app
 * dependencies. Later phases extend these interfaces rather than creating
 * parallel concepts.
 */

export type { Load, LoadSignalContext, CollectionLoadContext, RecordLoadContext, MaybePromise, RecordIdentity, RecordIdentityValue, OptionLoadContext, OptionLoad } from './load'

export type { CollectionMeta, CollectionResult, RecordResult, SubmitError } from './results'
export type { UploadProgress, UploadContext, UploadOperation } from './upload'
export type { Coordinate, LocationPrediction, LocationOperations } from './location'

export type { Label, LabelDictionary } from './labels'
export type { DisplayField, DisplayValueConfiguration } from './display'
export type { BaseInputControlBindings } from './formControlBindings'
export type { TableColumn, TableColumnCell, TableColumnContext, TableColumnEntry, TableColumnResolver, TableDefinition, TableColumnsContext } from './tables'
export type { DetailField, DetailFieldContext, DetailFieldEntry, DetailFieldResolver, DetailDefinition, DetailFieldsContext } from './details'
export type {
  FormBehaviorContext,
  FormBehavior,
  FormInput,
  FormFieldContext,
  FormFieldEntry,
  FormFieldsContext,
  FormFieldBinding,
  BoundFormInput,
  FormFields,
  FormDraft,
  FormDraftSnapshot,
  FormInputSlotField,
  FormInputSlotProps,
  FormActionSlotProps,
  FormExposed,
  FormSlots,
  FormDefinitionValidatorContext,
  FormDefinitionValidatorResult,
  FormValidatorDescriptor,
  FormValidatorEntry,
  FormValidationTrigger,
  FormDefinition,
} from './forms'
export type {
  DialogFormCloseContext,
  DialogFormCloseReason,
  DialogFormPresentationProps,
  DialogFormSlots,
  DialogFormProps,
  FormBindingProps,
  FormProps,
  FormRuntimeProps,
  FormSubmit,
} from '../forms/props'

export type { RawSchema, RawSchemaInput, RawSchemaOutput, SchemaIssue, SchemaParseResult } from './schema'

export type { ResourceOperation, StandardRowOperation, AccessRequest, AccessAdapter, AccessPolicy } from './access'

export type { QueryNamespace, QueryValues, QueryLocationAdapter, QueryKey } from './query'

export type { CollectionProps, CollectionSlotProps, TableProps, TreeTableProps, TableContentProps, TreeRowContext, TreePresentationOptions, TreeTableContentProps, DetailProps, RowReorderPayload } from './components'
export type { AfterSubmitContext, DetailViewControls, DetailViewProps, DetailViewReadyProps, FormViewProps, FormViewSlots, ListFilters, ListViewActions, ListViewDeleteState, ListViewProps, ListViewSlotActions } from './views'
