<script setup lang="ts">
const props = defineProps({
  data: {
    type: Array<any>,
    required: true,
  },
})
</script>

<template>
  <div class="flex flex-col">
    <div v-for="item in props.data" class="flex max-h-fit max-w-fit flex-row gap-4">
      <div class="flex flex-col">
        <div class="flex items-center justify-center">
          <slot name="node" v-bind="{ data: item }"></slot>
        </div>
        <div class="flex h-full items-center justify-center">
          <div class="h-full w-[1px] border"></div>
        </div>
      </div>
      <div class="flex flex-col">
        <div class="">
          <slot name="header" v-bind="{ data: item }"></slot>
        </div>

        <div class="">
          <slot name="content" v-bind="{ data: item }"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
