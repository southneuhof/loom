import { inject, type InjectionKey } from 'vue'

export interface FrameworkUiDefaultsInput {
  backLabel?: string
  submitLabel?: string
}

export interface ResolvedFrameworkUiDefaults {
  backLabel?: string
  submitLabel: string
}

export const frameworkUiDefaultsKey: InjectionKey<ResolvedFrameworkUiDefaults> =
  Symbol.for('loom-ui-defaults')

export function resolveFrameworkUiDefaults(
  input: FrameworkUiDefaultsInput = {},
): ResolvedFrameworkUiDefaults {
  return {
    ...(input.backLabel === undefined ? {} : { backLabel: input.backLabel }),
    submitLabel: input.submitLabel ?? 'Submit',
  }
}

export function useFrameworkUiDefaults(): ResolvedFrameworkUiDefaults {
  return inject(frameworkUiDefaultsKey) ?? resolveFrameworkUiDefaults()
}
