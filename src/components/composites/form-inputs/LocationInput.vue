<script setup lang="ts">
import { GoogleMap, Marker } from "vue3-google-map";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";
import { z } from "zod/v4";
import type {
  Coordinate,
  LocationOperations,
  LocationPrediction,
} from "../../../contracts";
import type { FormDraftSnapshot, FormFields } from "../../../contracts/forms";
import { commonProps } from "../../inputs/commonprops";
import Popover from "../../base/Popover.vue";
import SearchBox from "../../inputs/SearchBox.vue";
import BaseInput from "../../inputs/BaseInput.vue";
import Form from "../../core/Form.vue";
import { defineForm } from "../../../forms/defineForm";
import Button from "../../base/Button.vue";
import Card from "../../base/Card.vue";
import Icon from "../../base/Icon.vue";
import Spinner from "../../base/Spinner.vue";
import Tooltip from "../../base/Tooltip.vue";

const props = defineProps({
  ...commonProps,
  operations: { type: Object as PropType<LocationOperations>, required: true },
});
const modelValue = defineModel<Coordinate>();
const emit = defineEmits<{ (event: "validation:touch"): void }>();
const query = ref("");
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
let autocompleteGeneration = 0;
let detailGeneration = 0;
let geolocationGeneration = 0;

const locationSchema = z.object({
  name: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  formatted_address: z.string().optional(),
});
type LocationInput = z.input<typeof locationSchema>;
const locationFields = {
  name: {
    label: "Nama Lokasi",
    renderer: "text",
  },
} satisfies FormFields<LocationInput>;
const locationForm = defineForm({ schema: locationSchema, fields: locationFields });

const formModel = computed<Coordinate>(
  () => modelValue.value ?? { lat: center.value.lat, lng: center.value.lng },
);

function updateFormModel(value: FormDraftSnapshot<LocationInput>) {
  geolocationGeneration += 1;
  modelValue.value = {
    lat: Number(value.lat ?? modelValue.value?.lat ?? center.value.lat),
    lng: Number(value.lng ?? modelValue.value?.lng ?? center.value.lng),
    name: value.name ?? modelValue.value?.name,
    formatted_address:
      value.formatted_address ?? modelValue.value?.formatted_address,
  };
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
    const result = await props.operations.mapConfig({ signal: controller.signal });
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
  if (!input) return;
  const generation = ++autocompleteGeneration;
  const controller = new AbortController();
  autocompleteController = controller;
  try {
    const result = await props.operations.autocomplete({
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
  }
}

async function selectPrediction(prediction: LocationPrediction) {
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
      id: prediction.id,
      signal: controller.signal,
    });
    if (generation !== detailGeneration || controller.signal.aborted)
      return;
    modelValue.value = result;
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
  geolocationGeneration += 1;
  void autocomplete(value);
});
onMounted(loadConfig);
onBeforeUnmount(() => {
  geolocationGeneration += 1;
  configController?.abort();
  autocompleteController?.abort();
  detailController?.abort();
});
</script>

<template>
  <BaseInput v-bind="props">
    <div class="grid grid-cols-12 gap-8">
      <div class="col-span-3 flex flex-col gap-4">
        <Popover class="w-full">
          <template #trigger
            ><SearchBox
              v-model="query"
              v-bind="{ id: 'location-search-box' }"
              class="w-full"
              placeholder="Cari lokasi..."
          /></template>
          <template #content>
            <Card color="surfaceContainerHigh" class="min-w-full gap-2">
              <Card
                v-for="prediction in predictions"
                :key="prediction.id"
                :color="
                  prediction.id === selectedId
                    ? 'primaryContainer'
                    : 'surfaceContainerHigh'
                "
                class="flex-col gap-0"
                @click="selectPrediction(prediction)"
              >
                <div class="min-w-max">{{ prediction.primaryText }}</div>
                <div class="truncate text-sm">
                  {{ prediction.secondaryText }}
                </div>
              </Card>
              <div v-if="!query">Masukkan kata kunci untuk mencari lokasi</div>
              <div v-else-if="!predictions.length" class="text-muted">
                Tidak ada data
              </div>
            </Card>
          </template>
        </Popover>
        <Card color="surfaceContainerHigh" class="flex-row items-center gap-4">
          <Tooltip
            ><template #content>Gunakan lokasi saat ini</template
            ><template #trigger
              ><Button
                kind="icon"
                variant="standard"
                ariaLabel="Gunakan lokasi saat ini"
                @click="getCurrentLocation"
                >
                  <template #icon><Icon name="map-pin" /></template>
                </Button></template
          ></Tooltip>
          <div v-if="modelValue">
            {{ modelValue.lat }}, {{ modelValue.lng }}
            <div v-if="modelValue.formatted_address">
              {{ modelValue.formatted_address }}
            </div>
          </div>
          <p v-else class="text-muted">Pilih lokasi</p>
        </Card>
        <Form v-if="modelValue" v-bind="locationForm" :model-value="formModel" @update:model-value="updateFormModel" />
        <p v-if="error" role="alert" class="text-error">{{ error }}</p>
        <div v-if="loading" class="flex items-center gap-4">
          <Spinner />Memuat...
        </div>
      </div>
      <div class="col-span-9 w-full">
        <GoogleMap
          v-if="apiKey"
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
