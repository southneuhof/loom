<script setup lang="ts">
import Button from '../Button.vue'

const label = 'Open checklist'
</script>

<template>
  <Button aria-label="Open checklist" />
  <Button :aria-label="label" />
  <Button :ariaLabel="label" href="/checklists" />
</template>
