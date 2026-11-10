<script lang="ts">
import { defineComponent, provide } from 'vue'
import { tableFooterOwnerKey } from './tableComposition'

export default defineComponent({
  name: 'TreeSubtreeFooter',
  props: { ownerKey: { type: String, required: true } },
  setup(props, { slots }) {
    provide(tableFooterOwnerKey, props.ownerKey)
    return () => slots.default?.()
  },
})
</script>
