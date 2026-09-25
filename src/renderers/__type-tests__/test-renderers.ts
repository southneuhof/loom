import { defineComponent, h } from 'vue'
import type { FormRendererComponents } from '../formContracts'

const RatingInput = defineComponent({
  name: 'RatingTestInput',
  props: {
    modelValue: { type: Number, default: 0 },
    max: { type: Number, default: 5 },
    mode: { type: String as () => 'stars' | 'points', required: true },
    label: { type: String, default: '' },
  },
  emits: {
    'update:modelValue': (value: number) => typeof value === 'number',
  },
  setup(props) {
    return () => h('div', `${props.label}:${props.max}`)
  },
})

declare module '../formContracts' {
  interface FormRendererComponents {
    rating: typeof RatingInput
  }
}

export type TestRendererKeys = keyof FormRendererComponents
export const ratingInputForTests = RatingInput
void ratingInputForTests
