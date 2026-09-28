export type TextareaInputConstraint = 'number' | 'text'

type TextareaConstraintModelValue<TConstraint extends readonly TextareaInputConstraint[]> = 1 extends TConstraint['length']
  ? 'number' extends TConstraint[0]
    ? Exclude<TConstraint['length'], 1> extends never
      ? 'text' extends TConstraint[0] ? string | number | undefined : number | undefined
      : string | number | undefined
    : string | undefined
  : string | undefined

export type TextareaInputModelValue<
  TConstraint extends readonly TextareaInputConstraint[] | undefined = readonly ['text', 'number'],
> = TConstraint extends readonly TextareaInputConstraint[]
  ? TextareaConstraintModelValue<TConstraint>
  : TConstraint extends undefined
    ? string | undefined
    : never
