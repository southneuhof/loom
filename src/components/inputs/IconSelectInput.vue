<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useVirtualList } from '@vueuse/core'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Dialog from '../base/Dialog.vue'
import { extractRemixiconClassNamesFromStyleSheets, filterRemixiconClassNames, normalizeRemixiconClass, toIconRows } from './iconSelect.utils'

const GRID_COLUMNS = 12
const ROW_HEIGHT = 44

const props = defineProps({
  ...commonProps,
})

const emit = defineEmits<{
  (event: 'validation:touch'): void
}>()

const modelValue = defineModel<string>()

const open = ref(false)
const query = ref('')
const allIcons = ref<string[]>([])
const loadingIcons = ref(false)

const selectedClass = computed(() => normalizeRemixiconClass(modelValue.value))
const filteredIcons = computed(() => filterRemixiconClassNames(allIcons.value, query.value))
const iconRows = computed(() => toIconRows(filteredIcons.value, GRID_COLUMNS))

const { list: virtualRows, containerProps, wrapperProps } = useVirtualList(iconRows, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
})

function pickIcon(iconClass: string) {
  modelValue.value = iconClass
  emit('validation:touch')
}

function clearSelection() {
  modelValue.value = ''
  emit('validation:touch')
}

function loadIconsFromStylesheets() {
  loadingIcons.value = true
  allIcons.value = extractRemixiconClassNamesFromStyleSheets(Array.from(document.styleSheets) as CSSStyleSheet[])
  loadingIcons.value = false
}

function openPicker() {
  if (props.disabled) return
  open.value = true
  if (!allIcons.value.length) {
    loadIconsFromStylesheets()
  }
}

onMounted(() => {
  // Keep extraction lazy by default; this ensures document is available and avoids SSR access.
})
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex w-full flex-col gap-2">
      <div class="flex items-center gap-3">
        <Dialog v-model="open" :disabled="disabled">
          <template #trigger>
            <div
              :key="`${selectedClass}`"
              class="overlay flex max-w-fit cursor-pointer flex-row items-center justify-between gap-3 rounded-lg bg-surface-container-high px-4 py-2 after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
              @click="openPicker"
            >
              <template v-if="selectedClass">
                <i :class="selectedClass" class="text-lg"></i>
                <p class="min-w-max">{{ selectedClass }}</p>
              </template>
              <p v-else class="min-w-max">Select icon</p>
            </div>
          </template>
          <template #content>
            <div class="flex items-center gap-3 border-b border-outline-variant pb-4">
              <input
                v-model="query"
                type="text"
                placeholder="Cari icon..."
                class="w-full rounded-lg bg-surface-container px-3 py-2 text-sm outline outline-1 outline-outline/[24%]"
              />
              <Button type="button" variant="outlined" @click="clearSelection" :disabled="disabled || !selectedClass">Clear</Button>
            </div>

            <div v-if="loadingIcons" class="flex h-full items-center justify-center text-sm text-muted">
              Memuat icon...
            </div>

            <div v-else-if="!filteredIcons.length" class="flex h-full items-center justify-center text-sm text-muted">
              Icon tidak ditemukan.
            </div>

            <div
              v-else
              v-bind="containerProps"
              class="h-[60vh] overflow-y-auto"
            >
              <div v-bind="wrapperProps">
                <div
                  v-for="row in virtualRows"
                  :key="row.index"
                  class="grid grid-cols-12 gap-1"
                  :style="{ height: `${ROW_HEIGHT}px` }"
                >
                  <Button
                    v-for="iconClass in row.data"
                    :key="iconClass"
                    kind="icon"
                    :variant="selectedClass === iconClass ? 'outlined' : 'standard'"
                    type="button"
                    :aria-label="iconClass"
                    :title="iconClass"
                    @click="pickIcon(iconClass)"
                  >
                    <template #icon>
                      <i :class="iconClass" class="text-xl"></i>
                    </template>
                  </Button>
                </div>
              </div>
            </div>
          </template>
        </Dialog>
      </div>
    </div>
  </BaseInput>
</template>
