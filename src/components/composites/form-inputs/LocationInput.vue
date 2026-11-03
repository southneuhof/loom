<script setup lang="ts">
import Popover from "../../base/Popover.vue";
import OpenStreetMap from "../../utils/OpenStreetMap.vue";
import { GoogleMap, Marker } from "vue3-google-map";
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  useAttrs,
  useId,
  type PropType,
} from "vue";
import type {
  Coordinate,
  LocationOperations,
  LocationPrediction,
} from "../../../contracts";
import { commonProps } from "../../inputs/commonprops";
import SearchBox from "../../inputs/SearchBox.vue";
import BaseInput from "../../inputs/BaseInput.vue";
import Button from "../../base/Button.vue";
import Card from "../../base/Card.vue";
import Icon from "../../base/Icon.vue";
import Spinner from "../../base/Spinner.vue";
import Tooltip from "../../base/Tooltip.vue";

const props = defineProps({
  ...commonProps,
  mapProvider: { type: String as PropType<"google" | "openstreetmap">, default: "google" },
  operations: { type: Object as PropType<LocationOperations>, required: true },
});
const attrs = useAttrs();
const modelValue = defineModel<Coordinate | null>();
const emit = defineEmits<{ (event: "validation:touch"): void }>();
const query = ref("");
const searchOpen = ref(false);
const searching = ref(false);
const activePrediction = ref(-1);
const searchAnchor = ref<HTMLDivElement>();
const resultsId = useId();

function searchBindings() {
  return {
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-expanded": searchOpen.value,
    "aria-controls": resultsId,
    "aria-activedescendant": activePrediction.value >= 0 ? resultsId + "-" + activePrediction.value : undefined,
    onFocus: () => { searchOpen.value = Boolean(query.value.trim()); },
    onClick: () => { searchOpen.value = Boolean(query.value.trim()); },
    onKeydown: searchKeydown,
  };
}

function searchKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    searchOpen.value = false;
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    searchOpen.value = Boolean(query.value.trim());
    const count = predictions.value.length;
    if (count) activePrediction.value = activePrediction.value < 0
      ? (event.key === "ArrowDown" ? 0 : count - 1)
      : (activePrediction.value + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
  }
  if (event.key === "Enter" && searchOpen.value) {
    event.preventDefault();
    const prediction = predictions.value[activePrediction.value];
    if (prediction) void selectPrediction(prediction);
  }
}
const zoom = ref(5);
const center = ref<Coordinate>(
  modelValue.value ?? { lat: -1.2100164677737193, lng: 117.56306695042623 },
);
const predictions = ref<readonly LocationPrediction[]>([]);
const selectedId = ref<string>();
const loading = ref(false);
const error = ref<string>();
const apiKey = ref<string>();
let configController: AbortController | undefined;
let autocompleteController: AbortController | undefined;
let detailController: AbortController | undefined;
let autocompleteTimer: ReturnType<typeof setTimeout> | undefined;
let autocompleteGeneration = 0;
let detailGeneration = 0;
let geolocationGeneration = 0;

function inputId(): string | undefined {
  return typeof attrs.id === "string" ? attrs.id : undefined;
}

watch(modelValue, (value) => {
  geolocationGeneration += 1;
  center.value = value ?? { lat: -1.2100164677737193, lng: 117.56306695042623 };
});

async function loadConfig() {
  configController?.abort();
  const controller = new AbortController();
  configController = controller;
  loading.value = true;
  error.value = undefined;
  try {
    const result = await props.operations.mapConfig({ ...(props.mapProvider === "openstreetmap" ? { mapProvider: props.mapProvider } : {}), signal: controller.signal });
    if (!controller.signal.aborted) apiKey.value = result.apiKey;
  } catch (reason) {
    if (!controller.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}

async function autocomplete(input: string) {
  autocompleteController?.abort();
  predictions.value = [];
  if (!input.trim()) { searching.value = false; return; }
  error.value = undefined;
  const generation = ++autocompleteGeneration;
  const controller = new AbortController();
  autocompleteController = controller;
  try {
    const result = await props.operations.autocomplete({
      ...(props.mapProvider === "openstreetmap" ? { mapProvider: props.mapProvider } : {}),
      input,
      signal: controller.signal,
    });
    if (
      generation === autocompleteGeneration &&
      !controller.signal.aborted
    )
      predictions.value = result;
  } catch (reason) {
    if (generation === autocompleteGeneration && !controller.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (generation === autocompleteGeneration && !controller.signal.aborted) searching.value = false;
  }
}

async function selectPrediction(prediction: LocationPrediction) {
  searchAnchor.value?.querySelector("input")?.focus();
  searchOpen.value = false;
  geolocationGeneration += 1;
  detailController?.abort();
  const generation = ++detailGeneration;
  const controller = new AbortController();
  detailController = controller;
  loading.value = true;
  error.value = undefined;
  selectedId.value = prediction.id;
  try {
    const result = await props.operations.detail({
      ...(props.mapProvider === "openstreetmap" ? { mapProvider: props.mapProvider } : {}),
      id: prediction.id,
      signal: controller.signal,
    });
    if (generation !== detailGeneration || controller.signal.aborted)
      return;
    modelValue.value = { lat: result.lat, lng: result.lng };
    emit("validation:touch");
  } catch (reason) {
    if (generation === detailGeneration && !controller.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (generation === detailGeneration) loading.value = false;
  }
}

function getCurrentLocation() {
  const generation = ++geolocationGeneration;
  if (!globalThis.navigator?.geolocation) {
    error.value = "Geolocation tidak tersedia.";
    return;
  }
  loading.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (generation !== geolocationGeneration) return;
      loading.value = false;
      modelValue.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      emit("validation:touch");
    },
    (reason) => {
      if (generation !== geolocationGeneration) return;
      loading.value = false;
      error.value = reason.message || "Lokasi tidak dapat diakses.";
    },
  );
}

function updateCoordinate(lat: number, lng: number) {
  geolocationGeneration += 1;
  modelValue.value = { lat, lng };
  emit("validation:touch");
}

function updateCoordinateFromMap(event: { latLng?: { lat: () => number; lng: () => number } | null }) {
  if (!event.latLng) return;
  updateCoordinate(event.latLng.lat(), event.latLng.lng());
}

watch(query, (value) => {
  error.value = undefined;
  searchOpen.value = Boolean(value.trim());
  searching.value = Boolean(value.trim());
  activePrediction.value = -1;
  geolocationGeneration += 1;
  clearTimeout(autocompleteTimer);
  autocompleteController?.abort();
  autocompleteGeneration += 1;
  predictions.value = [];
  if (props.mapProvider === "openstreetmap") autocompleteTimer = setTimeout(() => void autocomplete(value), 300);
  else void autocomplete(value);
});
watch(() => props.mapProvider, () => {
  autocompleteController?.abort();
  detailController?.abort();
  autocompleteGeneration += 1;
  detailGeneration += 1;
  predictions.value = [];
  query.value = "";
  apiKey.value = undefined;
  void loadConfig();
});
onMounted(loadConfig);
onBeforeUnmount(() => {
  geolocationGeneration += 1;
  clearTimeout(autocompleteTimer);
  configController?.abort();
  autocompleteController?.abort();
  detailController?.abort();
});
</script>

<template>
  <BaseInput v-bind="props" :id="inputId()" v-slot="{ controlBindings }">
    <div class="grid grid-cols-12 gap-8">
      <div class="col-span-3 flex flex-col gap-4">
        <Popover v-model="searchOpen" anchor match-width content-class="gap-1 p-1 max-h-72 overflow-y-auto w-full">
          <template #trigger>
            <div ref="searchAnchor" class="w-full">
              <SearchBox
                v-model="query"
                v-bind="{ ...controlBindings, ...searchBindings() }"
                :debounced="false"
                class="w-full"
                placeholder="Cari lokasi..."
              />
            </div>
          </template>
          <template #content>
              <div v-if="searching" role="status" class="p-2 text-center text-muted">Mencari...</div>
              <div v-else-if="error" role="status">Pencarian gagal. Coba lagi.</div>
              <div v-else-if="!predictions.length" role="status">No results</div>
              <div :id="resultsId" role="listbox" aria-label="Hasil pencarian lokasi" class="flex flex-col gap-1">
                <Card
                  v-for="(prediction, index) in predictions"
                  v-bind="{ id: resultsId + '-' + index, role: 'option', 'aria-selected': activePrediction === index }"
                  :key="prediction.id"
                  class="w-full flex-col gap-0.5 p-3 text-left"
                  :color="activePrediction === index ? 'primaryContainer' : 'surfaceContainerHigh'"
                  @pointerdown.prevent
                  @click="selectPrediction(prediction)"
                >
                  <span>{{ prediction.primaryText }}</span>
                  <span class="text-sm">{{ prediction.secondaryText }}</span>
                </Card>
              </div>
          </template>
        </Popover>
        <Card color="surfaceContainerHigh" class="flex-row items-center gap-4">
          <Tooltip
            ><template #content>Gunakan lokasi saat ini</template
            ><template #trigger
              ><Button
                kind="icon"
                variant="standard"
                type="button"
                ariaLabel="Gunakan lokasi saat ini"
                @click="getCurrentLocation"
                >
                  <template #icon><Icon name="map-pin" /></template>
                </Button></template
          ></Tooltip>
          <div v-if="modelValue">
            {{ modelValue.lat }}, {{ modelValue.lng }}
          </div>
          <p v-else class="text-muted">Pilih lokasi</p>
        </Card>
        <Button v-if="modelValue" type="button" variant="text" :disabled="props.disabled" @click="modelValue = null">Clear location</Button>
        <p v-if="error" role="alert" class="text-error">{{ error }}</p>
        <div v-if="loading" class="flex items-center gap-4">
          <Spinner />Memuat...
        </div>
      </div>
      <div class="col-span-9 w-full">
        <OpenStreetMap v-if="mapProvider === 'openstreetmap'" :center="center" :location="modelValue" :disabled="props.disabled" @select="updateCoordinate($event.lat, $event.lng)" />
        <GoogleMap
          v-if="apiKey && mapProvider === 'google'"
          class="h-[450px] w-full"
          :api-key="apiKey"
          :center="center"
          :zoom="zoom"
          @click="updateCoordinateFromMap"
        >
          <Marker
            v-if="modelValue"
            :options="{ position: modelValue, draggable: true }"
            @dragend="updateCoordinateFromMap"
          />
        </GoogleMap>
      </div>
    </div>
  </BaseInput>
</template>
