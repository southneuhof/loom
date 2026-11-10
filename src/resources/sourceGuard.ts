export interface SourceGuard<TRecord extends object, TLoadContext> {
  beforeLoad(context: TLoadContext): void
  record(record: TRecord): void
}

export function composeSourceGuards<TRecord extends object, TLoadContext>(...guards: readonly SourceGuard<TRecord, TLoadContext>[]): SourceGuard<TRecord, TLoadContext> {
  return {
    beforeLoad(context) { for (const guard of guards) guard.beforeLoad(context) },
    record(record) { for (const guard of guards) guard.record(record) },
  }
}
