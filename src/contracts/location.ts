import type { MaybePromise } from './load'

export interface Coordinate {
  name?: string
  lat: number
  lng: number
  formatted_address?: string
}

export interface LocationPrediction {
  id: string
  primaryText: string
  secondaryText?: string
}

export interface LocationOperations {
  autocomplete(context: { input: string; signal?: AbortSignal }): MaybePromise<readonly LocationPrediction[]>
  detail(context: { id: string; signal?: AbortSignal }): MaybePromise<Coordinate>
  mapConfig(context: { signal?: AbortSignal }): MaybePromise<{ apiKey: string }>
}
