<script setup lang="ts">
import { computed } from 'vue'
import remixiconTags from './remixicon-tags'
import type { PropType } from 'vue'

const props = defineProps({
  fill: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String,
    default: 'xl',
    validator: (value: string) => {
      const validSizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
      return validSizes.includes(value)
    },
  },
  name: {
    type: String as PropType<(typeof remixiconTags)[number]>,
    required: true,
  },
})

const boxSizeClassMap: any = {
  xs: 'w-[12px] h-[12px] text-xs',
  sm: 'w-[14px] h-[14px] text-sm',
  base: 'w-[16px] h-[16px] text-base',
  lg: 'w-[18px] h-[18px] text-lg',
  xl: 'w-[20px] h-[20px] text-xl',
  '2xl': 'w-[24px] h-[24px] text-2xl',
  '3xl': 'w-[30px] h-[30px] text-3xl',
  '4xl': 'w-[36px] h-[36px] text-4xl',
  '5xl': 'w-[48px] h-[48px] text-5xl',
  '6xl': 'w-[60px] h-[60px] text-6xl',
}
</script>

<template>
  <!-- {{remixiconTags}} -->
  <i :class="`ri-${props.name}-${props.fill ? 'fill' : 'line'} ${boxSizeClassMap[props.size]}`" class="inline-flex items-center justify-center leading-none"></i>
</template>
