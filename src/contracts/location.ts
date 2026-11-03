import type { MaybePromise } from './load'

export interface Coordinate {
  lat: number
  lng: number
}

export interface LocationPrediction {
  id: string
  primaryText: string
  secondaryText?: string
}

export interface LocationOperations {
  autocomplete(context: { mapProvider?: 'google' | 'openstreetmap'; input: string; signal?: AbortSignal }): MaybePromise<readonly LocationPrediction[]>
  detail(context: { mapProvider?: 'google' | 'openstreetmap'; id: string; signal?: AbortSignal }): MaybePromise<Coordinate>
  mapConfig(context: { mapProvider?: 'google' | 'openstreetmap'; signal?: AbortSignal }): MaybePromise<{ apiKey: string }>
}
