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

export type { CollectionMeta, CollectionResult, RecordResult } from './results'
export type { UploadProgress, UploadContext, UploadOperation } from './upload'
export type { Coordinate, LocationPrediction, LocationOperations } from './location'

export type {
  FieldKey,
  FieldContext,
  FieldRead,
  FieldWrite,
  FieldValidate,
  FieldInitialValue,
  FieldRendererInfo,
  DisplayRendererContext,
  FormRendererContext,
  FieldBehavior,
  FieldBehaviorPresentation,
  FieldBehaviorContext,
  FieldRendererSelection,
  FieldDisplayProjection,
  FieldTableProjection,
  FieldDetailProjection,
  FieldFormProjection,
  FieldDefinition,
  FieldReference,
  FieldOverride,
  FieldCatalog,
  ResolvedField,
  FieldsInput,
  FieldSelection,
} from './fields'

export type { ValidationIssue, ValidationResult, ValidationSchema, SubmitError, FormValidationTrigger, FormValidatorContext, FormValidatorResult, FormValidator, FormValidatorDefinition, FormValidatorInput } from './validation'

export type {
  SchemaIdentityDeclaration,
  WebResourceSchemaPart,
  WebResourceWriteSchemaPart,
  WebResourceSchema,
  WebResourceSchemaBoundary,
  WebResourceRecordOf,
  WebResourceQueryOf,
  WebResourceCreateOf,
  WebResourceUpdateOf,
  WebResourceIdentityOf,
} from './schema'

export type { ResourceOperation, AccessRequest, AccessAdapter, AccessPolicy } from './access'

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
  FormProps,
  FormSubmitHandler,
  DialogFormProps,
  DialogFormCloseReason,
  DialogFormCloseContext,
  RowReorderPayload,
} from './components'
