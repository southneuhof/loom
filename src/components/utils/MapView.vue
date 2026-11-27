<script setup lang="ts">
import { computed, normalizeClass } from 'vue'
import { twMerge } from 'tailwind-merge'
import { GoogleMap, Marker } from 'vue3-google-map'
import OpenStreetMap from './OpenStreetMap.vue'

const props = withDefaults(defineProps<{
  mapProvider?: 'openstreetmap' | 'google'
  location?: { lat: number | string; lng: number | string; address?: string } | null
  center?: { lat: number | string; lng: number | string }
  lat?: number | string
  lng?: number | string
  zoom?: number
}>(), { mapProvider: 'openstreetmap', zoom: 13 })

defineOptions({ inheritAttrs: false })

const apiKey = import.meta.env.GOOGLE_MAP_API_KEY
const point = computed(() => {
  if (props.location) return { lat: Number(props.location.lat), lng: Number(props.location.lng) }
  if (props.lat != null && props.lng != null) return { lat: Number(props.lat), lng: Number(props.lng) }
  return null
})
const mapCenter = computed(() =>
  props.center ? { lat: Number(props.center.lat), lng: Number(props.center.lng) } : point.value ?? { lat: 0, lng: 0 },
)
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl" v-bind="{ ...$attrs, class: undefined }">
    <GoogleMap
      v-if="props.mapProvider === 'google' && apiKey"
      :class="twMerge('h-[250px] w-full', normalizeClass($attrs.class))"
      :api-key="apiKey"
      :center="mapCenter"
      :zoom="props.zoom"
    >
      <Marker v-if="point" :options="{ position: point }" />
      <slot name="markers" />
    </GoogleMap>
    <OpenStreetMap
      v-else
      :class="twMerge('h-[250px] w-full', normalizeClass($attrs.class))"
      :center="mapCenter"
      :location="point"
      :zoom="props.zoom"
      disabled
    />
    <div v-if="props.location?.address" class="italic">{{ props.location.address }}</div>
  </div>
</template>
