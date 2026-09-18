import { defineComponent, h } from 'vue'
import type { FormRendererComponents } from '../formContracts'

const RatingInput = defineComponent({
  name: 'RatingTestInput',
  props: {
    max: { type: Number, default: 5 },
    label: { type: String, default: '' },
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
