<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import type { Coordinate, LocationOperations } from '../../../contracts/location'
import LocationInput from './LocationInput.vue'
import BaseInput from '../../inputs/BaseInput.vue'
import { commonProps } from '../../inputs/commonprops'
import Dialog from '../../base/Dialog.vue'
import Button from '../../base/Button.vue'
import Card from '../../base/Card.vue'
import Icon from '../../base/Icon.vue'

const props = defineProps({
  ...commonProps,
  mapProvider: { type: String as PropType<'google' | 'openstreetmap'>, default: 'openstreetmap' },
  operations: { type: Object as PropType<LocationOperations>, required: true },
  addLabel: { type: String, default: 'Add location' },
  emptyLabel: { type: String, default: 'No locations added yet' },
})

const modelValue = defineModel<Coordinate[] | undefined>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()

const locations = computed(() => (Array.isArray(modelValue.value) ? modelValue.value : []))
const tempLocation = ref<Coordinate | null | undefined>(undefined)

function openAdd() {
  tempLocation.value = undefined
}

function saveAdded(setOpen: (open: boolean) => void) {
  if (!tempLocation.value) return
  modelValue.value = [...locations.value, { ...tempLocation.value }]
  tempLocation.value = undefined
  emit('validation:touch')
  setOpen(false)
}

function openEdit(item: Coordinate) {
  tempLocation.value = { ...item }
}

function saveEdited(index: number, setOpen: (open: boolean) => void) {
  if (!tempLocation.value) return
  modelValue.value = locations.value.map((item, current) => (current === index ? { ...tempLocation.value! } : item))
  tempLocation.value = undefined
  emit('validation:touch')
  setOpen(false)
}

function removeAt(index: number) {
  if (props.disabled) return
  modelValue.value = locations.value.filter((_, current) => current !== index)
  emit('validation:touch')
}
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <div :id="controlBindings.id" role="group" class="flex flex-col gap-3">
      <div v-if="!props.disabled">
        <Dialog @open="openAdd" @close="tempLocation = undefined">
          <template #trigger>
            <Button type="button" variant="outlined">
              <template #icon><Icon name="add" /></template>
              {{ props.addLabel }}
            </Button>
          </template>
          <template #title>{{ props.addLabel }}</template>
          <template #description>Select a location on the map and save.</template>
          <template #content>
            <LocationInput v-model="tempLocation" :operations="operations" :map-provider="mapProvider" />
          </template>
          <template #footer="{ setOpen }">
            <div class="flex w-full justify-end gap-2">
              <Button type="button" variant="text" @click="setOpen(false)">Cancel</Button>
              <Button type="button" :disabled="!tempLocation" @click="saveAdded(setOpen)">Save</Button>
            </div>
          </template>
        </Dialog>
      </div>
      <div v-if="locations.length" class="flex flex-wrap gap-3">
        <div v-for="(item, index) in locations" :key="`${index}-${item.lat}-${item.lng}`" class="flex items-center gap-1">
          <Dialog :disabled="props.disabled" @open="openEdit(item)" @close="tempLocation = undefined">
            <template #trigger>
              <Card color="surfaceContainerHigh" class="flex max-w-fit cursor-pointer flex-row items-center gap-2 px-3 py-2 text-sm tabular-nums">
                <Icon name="map-pin" />
                <span>{{ item.lat }}, {{ item.lng }}</span>
              </Card>
            </template>
            <template #title>Edit location</template>
            <template #description>Update the selected coordinates and save.</template>
            <template #content>
              <LocationInput v-model="tempLocation" :operations="operations" :map-provider="mapProvider" />
            </template>
            <template #footer="{ setOpen }">
              <div class="flex w-full justify-end gap-2">
                <Button type="button" variant="text" @click="setOpen(false)">Cancel</Button>
                <Button type="button" :disabled="!tempLocation" @click="saveEdited(index, setOpen)">Save</Button>
              </div>
            </template>
          </Dialog>
          <Button
            v-if="!props.disabled"
            type="button"
            kind="icon"
            variant="standard"
            color="error"
            :ariaLabel="`Remove location ${index + 1}`"
            @click="removeAt(index)"
          >
            <template #icon><Icon name="close" /></template>
          </Button>
        </div>
      </div>
      <p v-else class="text-sm text-on-surface-variant">{{ props.emptyLabel }}</p>
    </div>
  </BaseInput>
</template>
