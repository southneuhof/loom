/**
 * Canonical migration contracts: types only, no behavior, no Vue or app
 * dependencies. Later phases extend these interfaces rather than creating
 * parallel concepts.
 */

export type {
  Load,
  LoadSignalContext,
  CollectionLoadContext,
  RecordLoadContext,
  MaybePromise,
  RecordIdentity,
  RecordIdentityValue,
  OptionLoadContext,
  OptionLoad,
} from './load'

export type { CollectionMeta, CollectionResult, RecordResult, SubmitError } from './results'
export type { UploadProgress, UploadContext, UploadOperation } from './upload'
export type { Coordinate, LocationPrediction, LocationOperations } from './location'

export type { Label, LabelDictionary } from './labels'
export type { DisplayField } from './display'
export type { TableColumn, TableDefinition } from './tables'
export type { DetailField, DetailDefinition } from './details'
export type {
  FormBehaviorContext,
  FormInputPresentation,
  FormBehavior,
  FormInput,
  FormFields,
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
  DialogFormProps,
  FormBindingProps,
  FormProps,
  FormRuntimeProps,
  FormSubmit,
} from '../forms/props'

export type {
  RawSchema,
  RawSchemaInput,
  RawSchemaOutput,
  SchemaFieldKind,
  SchemaFieldMetadata,
  SchemaIssue,
  SchemaParseResult,
} from './schema'

export type { ResourceOperation, StandardRowOperation, AccessRequest, AccessAdapter, AccessPolicy } from './access'

export type {
  QueryNamespace,
  QueryValues,
  QueryLocationAdapter,
  QueryKey,
} from './query'

export type {
  CollectionProps,
  CollectionSlotProps,
  TableProps,
  TreeTableProps,
  TableContentProps,
  DetailProps,
  RowReorderPayload,
} from './components'
