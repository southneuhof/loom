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
import type {
  Coordinate,
  FieldCatalog,
  LocationOperations,
  LocationPrediction,
} from "../../../contracts";
import { commonProps } from "../../inputs/commonprops";
import Popover from "../../base/Popover.vue";
import SearchBox from "../../inputs/SearchBox.vue";
import BaseInput from "../../inputs/BaseInput.vue";
import Form from "../../core/Form.vue";
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

const locationFields = {
  name: {
    label: "Nama Lokasi",
    form: { renderer: "text" },
  },
} satisfies FieldCatalog<Coordinate, Coordinate>;

const formModel = computed({
  get: () => modelValue.value as Coordinate,
  set: (value: Partial<Coordinate>) => {
    modelValue.value = {
      lat: Number(value?.lat ?? modelValue.value?.lat ?? center.value.lat),
      lng: Number(value?.lng ?? modelValue.value?.lng ?? center.value.lng),
      name: value?.name ?? modelValue.value?.name,
      formatted_address:
        value?.formatted_address ?? modelValue.value?.formatted_address,
    };
  },
});

watch(modelValue, (value) => {
  center.value = value ?? { lat: -1.2100164677737193, lng: 117.56306695042623 };
});

async function loadConfig() {
  configController?.abort();
  configController = new AbortController();
  loading.value = true;
  error.value = undefined;
  try {
    apiKey.value = (
      await props.operations.mapConfig({ signal: configController.signal })
    ).apiKey;
  } catch (reason) {
    if (!configController.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (!configController.signal.aborted) loading.value = false;
  }
}

async function autocomplete(input: string) {
  autocompleteController?.abort();
  predictions.value = [];
  if (!input) return;
  const generation = ++autocompleteGeneration;
  autocompleteController = new AbortController();
  try {
    const result = await props.operations.autocomplete({
      input,
      signal: autocompleteController.signal,
    });
    if (
      generation === autocompleteGeneration &&
      !autocompleteController.signal.aborted
    )
      predictions.value = result;
  } catch (reason) {
    if (!autocompleteController.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  }
}

async function selectPrediction(prediction: LocationPrediction) {
  detailController?.abort();
  const generation = ++detailGeneration;
  detailController = new AbortController();
  loading.value = true;
  error.value = undefined;
  selectedId.value = prediction.id;
  try {
    const result = await props.operations.detail({
      id: prediction.id,
      signal: detailController.signal,
    });
    if (generation !== detailGeneration || detailController.signal.aborted)
      return;
    modelValue.value = result;
    emit("validation:touch");
  } catch (reason) {
    if (!detailController.signal.aborted)
      error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    if (generation === detailGeneration) loading.value = false;
  }
}

function getCurrentLocation() {
  if (!globalThis.navigator?.geolocation) {
    error.value = "Geolocation tidak tersedia.";
    return;
  }
  loading.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      loading.value = false;
      modelValue.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      emit("validation:touch");
    },
    (reason) => {
      loading.value = false;
      error.value = reason.message || "Lokasi tidak dapat diakses.";
    },
  );
}

function updateCoordinate(lat: number, lng: number) {
  modelValue.value = { lat, lng };
  emit("validation:touch");
}

watch(query, autocomplete);
onMounted(loadConfig);
onBeforeUnmount(() => {
  configController?.abort();
  autocompleteController?.abort();
  detailController?.abort();
});
</script>

<template>
  <BaseInput v-bind="props">
    <div class="grid grid-cols-12 gap-8">
      <div class="col-span-3 flex flex-col gap-4">
        <Popover class="w-full" :ignore="['#location-search-box']" static>
          <template #trigger
            ><SearchBox
              v-model="query"
              id="location-search-box"
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
        <Form v-if="modelValue" v-model="formModel" :fields="locationFields" />
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
          @click="
            (event: any) =>
              updateCoordinate(event.latLng.lat(), event.latLng.lng())
          "
        >
          <Marker
            v-if="modelValue"
            :options="{ position: modelValue, draggable: true }"
            @dragend="
              (event: any) =>
                updateCoordinate(event.latLng.lat(), event.latLng.lng())
            "
          />
        </GoogleMap>
      </div>
    </div>
  </BaseInput>
</template>
