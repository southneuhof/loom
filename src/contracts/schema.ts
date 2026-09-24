export interface RawSchema<TInput = unknown, TOutput = unknown> {
  readonly _input: TInput
  readonly _output: TOutput
  parseAsync: (input: unknown) => Promise<TOutput>
}

export type RawSchemaInput<TSchema extends RawSchema> = TSchema['_input']
export type RawSchemaOutput<TSchema extends RawSchema> = TSchema['_output']

export type SchemaFieldKind = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'object' | 'array' | 'unknown'

export interface SchemaFieldMetadata {
  kind: SchemaFieldKind
  required: boolean
  options?: readonly string[]
}

export interface SchemaIssue {
  path: readonly (string | number)[]
  message: string
  kind?: 'operational'
}

export type SchemaParseResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; issues: SchemaIssue[] }
