<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import Button from './Button.vue'
import Card from './Card.vue'
import Icon from './Icon.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String as PropType<
      | 'surface'
      | 'surfaceContainerLowest'
      | 'surfaceContainerLow'
      | 'surfaceContainer'
      | 'surfaceContainerHigh'
      | 'surfaceContainerHighest'
      | 'primaryContainer'
      | 'secondaryContainer'
      | 'tertiaryContainer'
      | 'errorContainer'
    >,
    default: 'surfaceContainer',
  },
  unmount: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{ (e: 'update:isOpen', value: boolean): void }>()

const isOpen = ref<boolean>(props.isOpen)

watch(
  () => props.isOpen,
  (v) => {
    isOpen.value = v
  }
)
watch(isOpen, (v) => emit('update:isOpen', v))

function toggle() {
  isOpen.value = !isOpen.value
}

function setOpen(v: boolean) {
  isOpen.value = v
}
</script>

<template>
  <div class="flex flex-col">
    <Card :class="isOpen ? 'rounded-b-none' : ''" :color="color">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <slot name="preview" v-bind="{ isOpen, setOpen }"></slot>
        </div>
        <Button @click.stop="toggle" kind="icon" variant="standard">
          <Icon :name="isOpen ? 'arrow-up-s' : 'arrow-down-s'"></Icon>
        </Button>
      </div>
    </Card>
    <Card v-if="unmount ? isOpen : true" v-show="isOpen" class="rounded-t-none pt-0" :color="color">
      <slot name="content" v-bind="{ isOpen, setOpen }"></slot>
    </Card>
  </div>
</template>
