<script setup lang="ts">
import type { PropType } from 'vue'
import { Tippy } from 'vue-tippy'
</script>

<template>
  <Tippy :delay="300">
    <template #content>
      <slot name="content"></slot>
    </template>
    <slot name="trigger"></slot>
  </Tippy>
</template>
