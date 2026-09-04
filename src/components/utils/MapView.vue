<script setup lang="ts">
import { GoogleMap, Marker } from 'vue3-google-map'
import { computed, type PropType, ref } from 'vue'

const GOOGLE_MAP_API_KEY = import.meta.env.GOOGLE_MAP_API_KEY as string

const props = defineProps({
  location: {
    type: Object as PropType<{ lat: string | number; lng: string | number; address?: string }>,
    required: false,
  },
  center: {
    type: Object as PropType<{ lat: string | number; lng: string | number }>,
    required: false,
  },
  lat: {
    type: [String, Number] as PropType<string | number>,
    required: false,
  },
  lng: {
    type: [String, Number] as PropType<string | number>,
    required: false,
  },
  zoom: {
    type: Number,
    default: 10,
  },
})

const location = ref({ lat: 0, lng: 0 })
if (props.location) location.value = { lat: Number(props.location.lat), lng: Number(props.location.lng) }
else if (props.lat && props.lng) location.value = { lat: Number(props.lat), lng: Number(props.lng) }

const mapCenter = computed(() =>
  props.center ? { lat: Number(props.center.lat), lng: Number(props.center.lng) } : location.value,
)
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl">
    <GoogleMap :class="`h-[250px] w-full ${$attrs.class}`" :api-key="GOOGLE_MAP_API_KEY" :center="mapCenter" :zoom="zoom">
      <Marker v-if="props.location" :options="{ position: location }" />
      <slot name="markers"></slot>
    </GoogleMap>
    <div v-if="props.location?.address" class="italic">{{ props.location.address }}</div>
  </div>
</template>
