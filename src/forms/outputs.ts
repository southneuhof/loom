import { shallowReactive } from 'vue'
import { snapshotEditable } from './draftValues'

declare const outputType: unique symbol

export interface FormOutput<T> {
  readonly key: symbol
  readonly [outputType]?: T
}

export interface FormOutputs {
  get<T>(output: FormOutput<T>): T | undefined
}

export interface FormPublisher {
  <T>(output: FormOutput<T>, value: NoInfer<T> | undefined): void
}

export function defineFormOutput<T>(): FormOutput<T> {
  return Object.freeze({ key: Symbol('form-output') })
}

export function createFormOutputs() {
  const values = shallowReactive(new Map<symbol, unknown>())
  const outputs: FormOutputs = { get: <T>(output: FormOutput<T>) => values.get(output.key) as T | undefined }
  const publish: FormPublisher = (output, value) => {
    if (value === undefined) values.delete(output.key)
    else values.set(output.key, snapshotEditable(value))
  }
  return { outputs, publish, clear: () => values.clear() }
}
