type IsAny<TValue> = 0 extends 1 & TValue ? true : false

type ConcreteContext<TContext> = IsAny<TContext> extends true
  ? never
  : TContext extends object
    ? keyof TContext extends never ? never : TContext
    : never

type UnionToIntersection<TValue> = [TValue] extends [never]
  ? never
  : (TValue extends unknown ? (value: TValue) => void : never) extends (value: infer TIntersection) => void
    ? TIntersection
    : never

export type ContextRequirements<TContext> = UnionToIntersection<ConcreteContext<TContext>>

export type CallbackScopeContext<TEntry> = TEntry extends (...args: infer TArgs) => unknown
  ? TArgs extends [infer TActual]
    ? TActual extends { readonly context: infer TContext } ? TContext : never
    : never
  : never

export type ContextWithDefault<TContext> = [TContext] extends [never]
  ? Readonly<Record<string, unknown>>
  : Extract<TContext, object>
