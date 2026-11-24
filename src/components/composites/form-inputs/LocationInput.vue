<script setup lang="ts">
import Popover from '../../base/Popover.vue'
import Tooltip from '../../base/Tooltip.vue'
import OpenStreetMap from '../../utils/OpenStreetMap.vue'
import { GoogleMap, Marker } from 'vue3-google-map'
import { computed, onBeforeUnmount, onMounted, ref, watch, useAttrs, useId, type InputHTMLAttributes, type PropType } from 'vue'
import type { Coordinate, LocationOperations, LocationPrediction } from '../../../contracts/location'
import { commonProps } from '../../inputs/commonprops'
import SearchBox from '../../inputs/SearchBox.vue'
import BaseInput from '../../inputs/BaseInput.vue'
import Icon from '../../base/Icon.vue'
import Spinner from '../../base/Spinner.vue'

const props = defineProps({
  ...commonProps,
  mapProvider: { type: String as PropType<'google' | 'openstreetmap'>, default: 'google' },
  operations: { type: Object as PropType<LocationOperations>, required: true },
})
const attrs = useAttrs()
const modelValue = defineModel<Coordinate | null>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const query = ref('')
const searchOpen = ref(false)
const searching = ref(false)
const activePrediction = ref(-1)
const searchAnchor = ref<HTMLDivElement>()
const resultsId = useId()

function searchBindings(): InputHTMLAttributes {
  return {
    role: 'combobox',
    disabled: props.disabled,
    'aria-label': 'Search location',
    'aria-autocomplete': 'list',
    'aria-expanded': searchOpen.value,
    'aria-controls': resultsId,
    'aria-activedescendant': activePrediction.value >= 0 ? resultsId + '-' + activePrediction.value : undefined,
    onFocus: () => {
      searchOpen.value = Boolean(query.value.trim())
    },
    onClick: () => {
      searchOpen.value = Boolean(query.value.trim())
    },
    onKeydown: searchKeydown,
  }
}

function searchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    searchOpen.value = false
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    searchOpen.value = Boolean(query.value.trim())
    const count = predictions.value.length
    if (count) activePrediction.value = activePrediction.value < 0 ? (event.key === 'ArrowDown' ? 0 : count - 1) : (activePrediction.value + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
  }
  if (event.key === 'Enter' && searchOpen.value) {
    event.preventDefault()
    const prediction = predictions.value[activePrediction.value]
    if (prediction) void selectPrediction(prediction)
  }
}
const zoom = ref(14)
const center = ref<Coordinate>(modelValue.value ?? { lat: -1.2100164677737193, lng: 117.56306695042623 })
const predictions = ref<readonly LocationPrediction[]>([])
const loading = ref(false)
type LocationError = {
  message: string
  actionLabel: string
  retry: () => void
}
const error = ref<LocationError>()
const selectedPlace = ref<{ lat: number; lng: number; label: string }>()
const searchPlaceholder = computed(() => {
  const point = modelValue.value
  if (!point) return 'Search location...'
  const place = selectedPlace.value
  if (place && place.lat === point.lat && place.lng === point.lng) return place.label
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
})
const apiKey = ref<string>()
let configController: AbortController | undefined
let autocompleteController: AbortController | undefined
let detailController: AbortController | undefined
let autocompleteTimer: ReturnType<typeof setTimeout> | undefined
let autocompleteGeneration = 0
let detailGeneration = 0
let geolocationGeneration = 0

function inputId(): string | undefined {
  return typeof attrs.id === 'string' ? attrs.id : undefined
}

watch(modelValue, (value) => {
  geolocationGeneration += 1
  center.value = value ?? { lat: -1.2100164677737193, lng: 117.56306695042623 }
})

async function loadConfig() {
  configController?.abort()
  const controller = new AbortController()
  configController = controller
  loading.value = true
  error.value = undefined
  try {
    const result = await props.operations.mapConfig({ ...(props.mapProvider === 'openstreetmap' ? { mapProvider: props.mapProvider } : {}), signal: controller.signal })
    if (!controller.signal.aborted) apiKey.value = result.apiKey
  } catch {
    if (!controller.signal.aborted) error.value = { message: 'Unable to load map.', actionLabel: 'Try again', retry: loadConfig }
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}

async function autocomplete(input: string) {
  autocompleteController?.abort()
  predictions.value = []
  if (!input.trim()) {
    searching.value = false
    return
  }
  error.value = undefined
  searching.value = true
  searchOpen.value = true
  const generation = ++autocompleteGeneration
  const controller = new AbortController()
  autocompleteController = controller
  try {
    const result = await props.operations.autocomplete({
      ...(props.mapProvider === 'openstreetmap' ? { mapProvider: props.mapProvider } : {}),
      input,
      signal: controller.signal,
    })
    if (generation === autocompleteGeneration && !controller.signal.aborted) predictions.value = result
  } catch {
    if (generation === autocompleteGeneration && !controller.signal.aborted) {
      searchOpen.value = false
      error.value = {
        message: 'Location search failed.',
        actionLabel: 'Try again',
        retry: () => {
          void autocomplete(query.value)
        },
      }
    }
  } finally {
    if (generation === autocompleteGeneration && !controller.signal.aborted) searching.value = false
  }
}

async function selectPrediction(prediction: LocationPrediction) {
  searchAnchor.value?.querySelector('input')?.focus()
  searchOpen.value = false
  geolocationGeneration += 1
  detailController?.abort()
  const generation = ++detailGeneration
  const controller = new AbortController()
  detailController = controller
  loading.value = true
  error.value = undefined
  try {
    const result = await props.operations.detail({
      ...(props.mapProvider === 'openstreetmap' ? { mapProvider: props.mapProvider } : {}),
      id: prediction.id,
      signal: controller.signal,
    })
    if (generation !== detailGeneration || controller.signal.aborted) return
    modelValue.value = { lat: result.lat, lng: result.lng }
    selectedPlace.value = { lat: result.lat, lng: result.lng, label: [prediction.primaryText, prediction.secondaryText].filter(Boolean).join(', ') }
    query.value = ''
    emit('validation:touch')
  } catch {
    if (generation === detailGeneration && !controller.signal.aborted)
      error.value = {
        message: 'Unable to load location.',
        actionLabel: 'Try again',
        retry: () => {
          void selectPrediction(prediction)
        },
      }
  } finally {
    if (generation === detailGeneration) loading.value = false
  }
}

function getCurrentLocation() {
  error.value = undefined
  const generation = ++geolocationGeneration
  if (!globalThis.navigator?.geolocation) {
    error.value = { message: 'Browser ini tidak mendukung lokasi perangkat. Search location atau pilih titik pada peta.', actionLabel: 'Search location', retry: focusSearch }
    return
  }
  loading.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (generation !== geolocationGeneration) return
      loading.value = false
      modelValue.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      query.value = ''
      emit('validation:touch')
    },
    (reason) => {
      if (generation !== geolocationGeneration) return
      loading.value = false
      error.value = {
        message: reason.code === 1 ? 'User denied geolocation' : 'Unable to find your location.',
        actionLabel: 'Try again',
        retry: getCurrentLocation,
      }
    }
  )
}

function focusSearch() {
  searchAnchor.value?.querySelector('input')?.focus()
}

function clearLocation() {
  query.value = ''
  selectedPlace.value = undefined
  error.value = undefined
  modelValue.value = null
  emit('validation:touch')
}

function updateCoordinate(lat: number, lng: number) {
  query.value = ''
  error.value = undefined
  geolocationGeneration += 1
  modelValue.value = { lat, lng }
  emit('validation:touch')
}

function updateCoordinateFromMap(event: { latLng?: { lat: () => number; lng: () => number } | null }) {
  if (!event.latLng) return
  updateCoordinate(event.latLng.lat(), event.latLng.lng())
}

watch(query, (value) => {
  error.value = undefined
  searchOpen.value = Boolean(value.trim())
  searching.value = Boolean(value.trim())
  activePrediction.value = -1
  geolocationGeneration += 1
  clearTimeout(autocompleteTimer)
  autocompleteController?.abort()
  autocompleteGeneration += 1
  predictions.value = []
  if (props.mapProvider === 'openstreetmap') autocompleteTimer = setTimeout(() => void autocomplete(value), 300)
  else void autocomplete(value)
})
watch(
  () => props.mapProvider,
  () => {
    autocompleteController?.abort()
    detailController?.abort()
    autocompleteGeneration += 1
    detailGeneration += 1
    predictions.value = []
    query.value = ''
    apiKey.value = undefined
    void loadConfig()
  }
)
onMounted(loadConfig)
onBeforeUnmount(() => {
  geolocationGeneration += 1
  clearTimeout(autocompleteTimer)
  configController?.abort()
  autocompleteController?.abort()
  detailController?.abort()
})
</script>

<template>
  <BaseInput v-bind="props" :id="inputId()" v-slot="{ controlBindings }">
    <div class="location-preview relative isolate overflow-hidden rounded-2xl border border-outline-variant bg-surface-container outline outline-1 outline-outline/[24%] -outline-offset-1">
      <OpenStreetMap v-if="mapProvider === 'openstreetmap'" :center="center" :location="modelValue" :disabled="props.disabled" @select="updateCoordinate($event.lat, $event.lng)" />
      <GoogleMap
        v-if="apiKey && mapProvider === 'google'"
        class="h-[450px] w-full"
        :api-key="apiKey"
        :center="center"
        :zoom="zoom"
        :disable-default-ui="true"
        :zoom-control="true"
        @click="updateCoordinateFromMap"
      >
        <Marker v-if="modelValue" :options="{ position: modelValue, draggable: true }" @dragend="updateCoordinateFromMap" />
      </GoogleMap>

      <div class="map-top-shade pointer-events-none absolute inset-x-0 top-0 z-[900] h-40" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <div class="absolute inset-x-3 top-3 z-[1000] sm:right-auto sm:w-[min(28rem,calc(100%-1.5rem))]">
        <Popover v-model="searchOpen" anchor match-width content-class="location-search-results gap-0 p-1 max-h-72 overflow-y-auto w-full">
          <template #trigger>
            <div ref="searchAnchor" class="map-search relative w-full rounded-full text-on-surface">
              <SearchBox v-model="query" v-bind="{ ...controlBindings, ...searchBindings() }" :debounced="false" :placeholder="searchPlaceholder" class="w-full rounded-full" />
              <div class="absolute inset-y-0 right-1 flex items-center">
                <Tooltip v-if="modelValue">
                  <template #trigger>
                    <button type="button" class="map-tool" aria-label="Clear location" :disabled="props.disabled" @click="clearLocation">
                      <Icon name="close" />
                    </button>
                  </template>
                  <template #content>Clear location</template>
                </Tooltip>
                <Tooltip>
                  <template #trigger>
                    <button type="button" class="map-tool" aria-label="Use current location" :disabled="props.disabled || loading" @click="getCurrentLocation">
                      <Icon name="crosshair" />
                    </button>
                  </template>
                  <template #content>Use current location</template>
                </Tooltip>
              </div>
            </div>
          </template>
          <template #content>
            <div v-if="searching" role="status" class="flex min-h-24 flex-col items-center justify-center gap-2 px-4 py-5 text-center text-sm text-muted">
              <Spinner class="h-5 !min-h-0 w-5" />
              <span>Searching...</span>
            </div>
            <div v-else-if="!predictions.length && !error" role="status" class="flex min-h-24 flex-col items-center justify-center gap-1 px-4 py-5 text-center text-sm">
              <span>No results</span>
              <span class="text-muted">Try another place or address.</span>
            </div>
            <div v-else-if="predictions.length" :id="resultsId" role="listbox" aria-label="Location search results" class="flex flex-col">
              <button
                v-for="(prediction, index) in predictions"
                v-bind="{ id: resultsId + '-' + index, role: 'option', 'aria-selected': activePrediction === index }"
                :key="prediction.id"
                type="button"
                tabindex="-1"
                class="location-result flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left"
                @pointerdown.prevent
                @pointermove="activePrediction = index"
                @click="selectPrediction(prediction)"
              >
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-on-surface/[5%] text-muted"><Icon name="map-pin" /></span>
                <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="text-sm font-medium leading-5">{{ prediction.primaryText }}</span>
                  <span v-if="prediction.secondaryText" class="text-xs leading-5 text-muted">{{ prediction.secondaryText }}</span>
                </span>
              </button>
            </div>
          </template>
        </Popover>
        <div v-if="error" role="alert" class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface px-3 py-2 text-sm text-on-surface shadow-md">
          <span>{{ error.message }}</span>
          <button type="button" class="rounded px-1 py-1 font-medium text-primary underline underline-offset-4" :disabled="loading || searching" @click="error?.retry()">
            {{ error.actionLabel }}
          </button>
        </div>
      </div>
    </div>
  </BaseInput>
</template>

<style scoped>
.location-preview {
  clip-path: inset(0 round 1rem);
}
.map-top-shade {
  background: linear-gradient(to bottom, rgb(0 0 0 / 10%), transparent), linear-gradient(to bottom, rgb(var(--md-sys-color-surface) / 65%), rgb(var(--md-sys-color-surface) / 0%));
}
.map-top-shade > div {
  position: absolute;
  inset: 0;
  mask-image: linear-gradient(to bottom, black, transparent);
  backdrop-filter: blur(3px);
}
.map-top-shade > div:nth-child(2) {
  bottom: 25%;
  backdrop-filter: blur(8px);
}
.map-top-shade > div:nth-child(3) {
  bottom: 55%;
  backdrop-filter: blur(16px);
}
.map-search {
  background: rgb(var(--md-sys-color-on-surface) / 0%);
  transition: background-color 180ms ease-out;
}
.map-search:focus-within {
  background: rgb(var(--md-sys-color-on-surface) / 6%);
}
.map-search :deep(input) {
  min-width: 0;
  padding-right: 88px;
  color: inherit;
}
.map-search :deep(input::placeholder) {
  color: inherit;
  opacity: 0.75;
}
.map-search :deep(.text-primary) {
  color: inherit;
}
@media (prefers-reduced-transparency: reduce) {
  .map-top-shade {
    background: rgb(var(--md-sys-color-surface));
  }
  .map-top-shade > div {
    backdrop-filter: none;
  }
}
:global(.location-search-results .location-result:hover),
:global(.location-search-results .location-result[aria-selected='true']) {
  background: rgb(var(--md-sys-color-on-surface) / 6%);
}
:global([data-state]:has(> .location-search-results)) {
  transform-origin: var(--reka-popover-content-transform-origin);
}
:global([data-state='open']:has(> .location-search-results)) {
  animation: location-popover-in 180ms cubic-bezier(0.2, 0, 0, 1) both;
}
:global([data-state='closed']:has(> .location-search-results)) {
  animation: location-popover-out 120ms ease-in both;
}
@keyframes location-popover-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes location-popover-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}
@media (prefers-reduced-motion: reduce) {
  .map-search,
  :global(.location-search-results .location-result) {
    transition: none;
  }
  :global([data-state]:has(> .location-search-results)) {
    animation: none;
  }
}
.map-tool {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: inherit;
}
.map-tool:hover {
  background: rgb(var(--md-sys-color-on-surface) / 8%);
}
.location-preview :deep(:focus),
.location-preview :deep(:focus-visible),
:global(.location-search-results :focus),
:global(.location-search-results :focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}
.map-tool:disabled {
  opacity: 0.5;
}

.location-preview :deep(.leaflet-top.leaflet-left) {
  top: auto;
  right: 12px;
  bottom: 32px;
  left: auto;
}
.location-preview :deep(.leaflet-control-zoom) {
  margin: 0;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  box-shadow: 0 2px 8px #0002;
}
.location-preview :deep(.leaflet-control-zoom a) {
  background: rgb(var(--md-sys-color-surface));
  color: rgb(var(--md-sys-color-on-surface));
}
</style>
