<script setup lang="ts">
import { ref, type PropType } from 'vue'
import type { LocationOperations } from '../../../contracts'
import LocationInput from './LocationInput.vue'
import BaseInput from '../../inputs/BaseInput.vue'
import { commonProps } from '../../inputs/commonprops'
import Dialog from '../../base/Dialog.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  ...commonProps,
  operations: { type: Object as PropType<LocationOperations>, required: true },
})

const modelValue = defineModel<Array<any>>()

if (!modelValue.value) modelValue.value = []

const tempLocation = ref()
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex flex-col gap-4">
      <Dialog @close="() => (tempLocation = null)">
        <template #trigger>
          <Button><Icon name="add" />Tambah Lokasi</Button>
        </template>
        <template #content="{ setOpen }">
          <LocationInput v-model="tempLocation" :operations="operations" />
          <Button @click="() => [modelValue?.push(tempLocation), setOpen(false)]">Simpan</Button>
        </template>
      </Dialog>
      <div class="grid grid-cols-12 gap-4">
        <div class="col-span-8 flex flex-row flex-wrap gap-4">
          <template v-if="modelValue?.length">
            <Dialog v-for="item in modelValue" @open="() => (tempLocation = item)" @close="() => (tempLocation = null)">
              <template #trigger>
                <Card color="surfaceContainerHigh" class="flex h-full max-w-fit flex-row items-center">
                  <Icon name="map-pin" />
                  <div v-if="item.name" class="flex flex-col">
                    <div>{{ item.name }}</div>
                    <div class="text-sm text-muted">{{ item.lat }}, {{ item.lng }}</div>
                  </div>
                  <div v-else>{{ item.lat }}, {{ item.lng }}</div>
                </Card>
              </template>
              <template #content="{ setOpen }">
                <LocationInput v-model="tempLocation" :operations="operations" />
                <Button @click="() => setOpen(false)">Simpan</Button>
              </template>
            </Dialog>
          </template>
          <div v-else class="text-muted">Belum ada lokasi yang ditambahkan</div>
        </div>
        <div class="col-span-4"></div>
      </div>
    </div>
  </BaseInput>
</template>
