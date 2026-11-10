<script setup lang="ts" generic="TRecord extends object, TContext extends object">
import { computed } from 'vue'
import { ExportFields, ExportTable } from '@southneuhof/spool/vue'
import type { ViewExportSnapshot } from './document'
import DisplayValue from '../display/DisplayValue.vue'
const props = defineProps<{ snapshot: ViewExportSnapshot<TRecord, TContext> }>()
const entries = computed(() => props.snapshot.entries.map(row => Object.fromEntries(row.map(entry => [entry.field.key, entry]))))
</script>
<template>
  <ExportTable v-if="snapshot.document.kind === 'table'" :document="snapshot.document">
    <template #cell="{ column, index }">
      <DisplayValue v-if="entries[index]?.[column.id]" :field="entries[index]![column.id]!.field" :record="entries[index]![column.id]!.record" :value="entries[index]![column.id]!.value" :index="index" />
    </template>
  </ExportTable>
  <ExportFields v-else :document="snapshot.document">
    <template #value="{ index }">
      <DisplayValue v-if="snapshot.entries[0]?.[index]" :field="snapshot.entries[0][index]!.field" :record="snapshot.entries[0][index]!.record" :value="snapshot.entries[0][index]!.value" :index="index" />
    </template>
  </ExportFields>
</template>
