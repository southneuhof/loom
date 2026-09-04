<script setup lang="ts">import Icon from './Icon.vue'


const props = defineProps({
  value: {
    type: [Number, String],
    required: true,
  },
  outOf: {
    type: [Number, String],
    default: 5,
  },
})

function isRound(n: number) {
  return n - Math.floor(n) === 0
}
</script>

<template>
  <div class="flex flex-row items-center gap-1 text-warning" :class="($attrs.class as string)">
    <Icon v-for="item in Array(Math.floor(Number(value)))" name="star" :fill="true" />
    <Icon v-if="!isRound(Number(value))" name="star-half" :fill="true" />
    <Icon v-for="item in Array(Number(outOf) - Math.ceil(Number(value)))" name="star" />
  </div>
</template>
