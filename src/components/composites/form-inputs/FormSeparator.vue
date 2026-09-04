<script setup lang="ts">
const props = defineProps({
  label: String,
})
</script>

<template>
  <div class="col-span-12 flex flex-col gap-1">
    <p class="italic text-primary">{{ label }}</p>
    <div class="w-full border-t-[1px] border-t-primary"></div>
  </div>
</template>
