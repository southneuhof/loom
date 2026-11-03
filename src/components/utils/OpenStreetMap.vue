<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { map, tileLayer, marker, icon, type Map, type Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import type { Coordinate } from '../../contracts'

const props = defineProps<{
  center: Coordinate
  location?: Coordinate | null
  disabled?: boolean
}>()
const emit = defineEmits<{ select: [value: Coordinate] }>()
const container = ref<HTMLDivElement>()
let view: Map | undefined
let pin: Marker | undefined
let observer: ResizeObserver | undefined

function sync() {
  if (!view) return
  view.panTo(props.center)
  pin?.remove()
  pin = undefined
  if (!props.location) return
  pin = marker(props.location, {
    draggable: !props.disabled,
    icon: icon({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIconRetina,
      shadowUrl: markerShadow,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      shadowSize: [41, 41],
    }),
  }).addTo(view)
  pin.on('dragend', () => {
    if (!props.disabled && pin) {
      const point = pin.getLatLng()
      emit('select', { lat: point.lat, lng: point.lng })
    }
  })
}

onMounted(() => {
  if (!container.value) return
  view = map(container.value).setView(props.center, 5)
  tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(view)
  view.on('click', (event) => {
    if (!props.disabled) emit('select', { lat: event.latlng.lat, lng: event.latlng.lng })
  })
  observer = new ResizeObserver(() => view?.invalidateSize())
  observer.observe(container.value)
  sync()
})
watch(() => [props.center, props.location, props.disabled], sync)
onBeforeUnmount(() => {
  observer?.disconnect()
  view?.remove()
})
</script>

<template>
  <div ref="container" class="relative z-0 h-[450px] w-full" aria-label="Location map" />
</template>
