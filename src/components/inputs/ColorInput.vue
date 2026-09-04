<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import { twMerge } from 'tailwind-merge'
import BaseInput from './BaseInput.vue'
import Popover from '../base/Popover.vue'
import Icon from '../base/Icon.vue'
import { commonProps } from './commonprops'
import {
  alphaPercentToUnit,
  hexToHsva,
  hsvaToHex,
  hsvaToRgba,
  normalizeHexColor,
  sanitizeHexInput,
  sanitizePercentInput,
  unitAlphaToPercent,
  type HsvaColor,
} from './color.utils'
import Button from '../base/Button.vue'

type PresetColor = {
  id: string
  label?: string
  value: string
}

defineOptions({ inheritAttrs: false })

const props = defineProps({
  presetColors: {
    type: Array as PropType<PresetColor[]>,
    default: () => [],
  },
  placeholder: {
    type: String,
    default: 'Select color',
  },
  ...commonProps,
})

const emit = defineEmits(['validation:touch'])
const modelValue = defineModel<string>({ default: '' })

const open = ref(false)
const saturationAreaRef = ref<HTMLElement | null>(null)

const hsva = ref<HsvaColor>({ hue: 0, saturation: 0, value: 100, alpha: 1 })
const draftHex = ref('FFFFFF')
const draftAlphaPercent = ref('100')
const currentValue = ref('')

let removePointerListeners: (() => void) | null = null

const rgbColor = computed(() => hsvaToRgba({ ...hsva.value, alpha: 1 }))
const solidColorHex = computed(() => hsvaToHex({ ...hsva.value, alpha: 1 }).slice(0, 7))
const currentHexValue = computed(() => hsvaToHex(hsva.value))
const displayHex = computed(() => (currentValue.value || currentHexValue.value).slice(1, 7))
const displayAlphaPercent = computed(() => unitAlphaToPercent(hsva.value.alpha))
const checkerboardStyle =
  'linear-gradient(45deg, rgba(0, 0, 0, 0.08) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.08) 75%, rgba(0, 0, 0, 0.08)), linear-gradient(45deg, rgba(0, 0, 0, 0.08) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.08) 75%, rgba(0, 0, 0, 0.08))'

function syncDraftInputs() {
  draftHex.value = currentHexValue.value.slice(1, 7)
  draftAlphaPercent.value = String(unitAlphaToPercent(hsva.value.alpha))
}

function syncFromModelValue(value: unknown) {
  const normalized = normalizeHexColor(value)
  currentValue.value = normalized
  hsva.value = hexToHsva(normalized || '#FFFFFFFF')
  syncDraftInputs()
}

function touchValidation() {
  emit('validation:touch')
}

function commitHsva(nextHsva: HsvaColor, options: { touch?: boolean } = {}) {
  hsva.value = {
    hue: nextHsva.hue,
    saturation: Math.min(100, Math.max(0, nextHsva.saturation)),
    value: Math.min(100, Math.max(0, nextHsva.value)),
    alpha: Math.min(1, Math.max(0, nextHsva.alpha)),
  }

  const nextValue = hsvaToHex(hsva.value)
  currentValue.value = nextValue
  modelValue.value = nextValue
  syncDraftInputs()
  if (options.touch !== false) touchValidation()
}

function commitHexInput() {
  const sanitized = sanitizeHexInput(draftHex.value)
  if (sanitized.length !== 6) {
    syncDraftInputs()
    return
  }

  commitHsva(hexToHsva(`#${sanitized}${currentHexValue.value.slice(7, 9)}`))
}

function commitAlphaInput() {
  const sanitized = sanitizePercentInput(draftAlphaPercent.value)
  if (!sanitized) {
    syncDraftInputs()
    return
  }

  draftAlphaPercent.value = sanitized
  commitHsva({
    ...hsva.value,
    alpha: alphaPercentToUnit(Number(sanitized)),
  })
}

function handleHueInput(event: Event) {
  commitHsva({
    ...hsva.value,
    hue: Number((event.target as HTMLInputElement).value),
  })
}

function handleAlphaSliderInput(event: Event) {
  commitHsva({
    ...hsva.value,
    alpha: alphaPercentToUnit(Number((event.target as HTMLInputElement).value)),
  })
}

function updateSaturationValueFromPointer(clientX: number, clientY: number) {
  const element = saturationAreaRef.value
  if (!element) return

  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const saturation = ((clientX - rect.left) / rect.width) * 100
  const value = 100 - ((clientY - rect.top) / rect.height) * 100

  commitHsva({
    ...hsva.value,
    saturation,
    value,
  })
}

function clearPointerListeners() {
  removePointerListeners?.()
  removePointerListeners = null
}

function startSaturationDrag(event: MouseEvent) {
  if (props.disabled) return

  updateSaturationValueFromPointer(event.clientX, event.clientY)

  const handleMove = (moveEvent: MouseEvent) => {
    updateSaturationValueFromPointer(moveEvent.clientX, moveEvent.clientY)
  }

  const handleUp = () => {
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
    clearPointerListeners()
  }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleUp)
  removePointerListeners = () => {
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
  }
}

function applyPresetColor(value: string) {
  const normalized = normalizeHexColor(value)
  if (!normalized) return
  commitHsva(hexToHsva(normalized))
}

function clearColor() {
  currentValue.value = ''
  modelValue.value = ''
  hsva.value = hexToHsva('#FFFFFFFF')
  syncDraftInputs()
  touchValidation()
}

watch(
  () => modelValue.value,
  (value) => {
    if (normalizeHexColor(value) === currentValue.value) return
    syncFromModelValue(value)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearPointerListeners()
})
</script>

<template>
  <BaseInput v-bind="props">
    <Popover v-model="open" :disabled="disabled">
      <template #trigger>
        <div
          :class="
            twMerge(
              `flex w-full min-w-0 items-center rounded-lg bg-surface-container outline outline-1 outline-outline/[24%] transition-all ease-linear focus-within:outline-2 ${
                error ? 'outline-error' : ''
              } ${disabled ? 'pointer-events-none cursor-not-allowed !bg-surface-variant/50' : ''}`,
              ($attrs.class as string),
            )
          "
          data-testid="color-trigger"
        >
          <div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
            <div
              class="color-checkerboard flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-md outline outline-1 outline-outline/[24%]"
              :style="{ backgroundSize: '12px 12px', backgroundPosition: '0 0, 6px 6px', backgroundImage: checkerboardStyle }"
            >
              <div class="h-full w-full" :style="{ backgroundColor: currentValue || currentHexValue }"></div>
            </div>
            <p v-if="currentValue" class="truncate font-medium uppercase">{{ displayHex }}</p>
            <p v-else class="truncate text-muted">{{ placeholder }}</p>
          </div>
          <div class="flex flex-none items-center gap-2 self-stretch border-l border-outline/[24%] px-3 py-2.5">
            <span class="w-10 text-right font-medium">{{ displayAlphaPercent }}</span>
            <span class="text-on-surface/[67%]">%</span>
            <Icon name="arrow-down-s" size="sm" class="text-on-surface/[67%]" />
          </div>
        </div>
      </template>
      <template #content>
        <div class="w-[320px] max-w-[calc(100vw-32px)] rounded-2xl border border-outline/[24%] bg-surface-container-high p-4 shadow-lg">
          <div
            ref="saturationAreaRef"
            class="relative h-52 cursor-crosshair overflow-hidden rounded-xl border border-outline/[24%]"
            :style="{ backgroundColor: `hsl(${hsva.hue} 100% 50%)` }"
            data-testid="color-saturation-area"
            @mousedown.prevent="startSaturationDrag"
          >
            <div class="absolute inset-0 bg-[linear-gradient(to_right,#fff,rgba(255,255,255,0))]"></div>
            <div class="absolute inset-0 bg-[linear-gradient(to_top,#000,rgba(0,0,0,0))]"></div>
            <div
              class="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(17,31,85,0.28)]"
              :style="{
                left: `${hsva.saturation}%`,
                top: `${100 - hsva.value}%`,
                backgroundColor: `rgb(${rgbColor.red}, ${rgbColor.green}, ${rgbColor.blue})`,
              }"
            ></div>
          </div>

          <div class="mt-4 flex flex-col gap-3">
            <input
              class="color-slider color-slider--hue"
              data-testid="color-hue-slider"
              type="range"
              min="0"
              max="360"
              :value="hsva.hue"
              @input="handleHueInput"
            />

            <div class="color-slider-track rounded-full h-[28px]" :style="{ backgroundSize: '12px 12px', backgroundPosition: '0 0, 6px 6px', backgroundImage: checkerboardStyle }">
              <input
                class="color-slider color-slider--alpha"
                data-testid="color-alpha-slider"
                type="range"
                min="0"
                max="100"
                :value="displayAlphaPercent"
                :style="{ background: `linear-gradient(to right, ${solidColorHex}00, ${solidColorHex}FF)` }"
                @input="handleAlphaSliderInput"
              />
            </div>
          </div>

          <div class="mt-4 flex items-stretch overflow-hidden rounded-xl border border-outline/[24%] bg-surface">
            <div class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
              <span class="rounded-md text-sm font-medium text-outline-variant">HEX</span>
              <input
                v-model="draftHex"
                class="min-w-0 flex-1 bg-transparent font-medium uppercase outline-none"
                maxlength="6"
                data-testid="color-hex-input"
                @input="draftHex = sanitizeHexInput(($event.target as HTMLInputElement).value)"
                @blur="commitHexInput"
                @keydown.enter.prevent="commitHexInput"
              />
              <Button
                v-if="currentValue"
                kind="icon"
                variant="standard"
                aria-label="Clear color"
                class="!p-0 !w-[16px] !h-[16px] !min-w-[16px]"
                type="button"
                data-testid="color-clear-button"
                @click="clearColor"
              >
                <template #icon>
                  <Icon name="close" size="sm"></Icon>
                </template>
              </Button>
            </div>
            <div class="flex items-center gap-2 border-l border-outline/[24%] px-3 py-2.5">
              <input
                v-model="draftAlphaPercent"
                class="w-10 bg-transparent text-right font-medium outline-none"
                inputmode="numeric"
                data-testid="color-alpha-input"
                @input="draftAlphaPercent = sanitizePercentInput(($event.target as HTMLInputElement).value)"
                @blur="commitAlphaInput"
                @keydown.enter.prevent="commitAlphaInput"
              />
              <span class="text-on-surface/[67%]">%</span>
            </div>
          </div>

          <div v-if="presetColors.length" class="mt-4 border-t border-outline/[24%] pt-4">
            <p class="mb-3 text-sm font-medium text-on-surface/[67%]">Preset colors</p>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="preset in presetColors"
                :key="preset.id"
                type="button"
                class="color-checkerboard flex h-10 w-full items-center justify-center rounded-lg border border-outline/[24%] transition-transform hover:scale-[1.02]"
                :class="currentValue === normalizeHexColor(preset.value) ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-high' : ''"
                :title="preset.label || preset.id"
                :style="{ backgroundSize: '12px 12px', backgroundPosition: '0 0, 6px 6px', backgroundImage: checkerboardStyle }"
                data-testid="color-preset"
                @click="applyPresetColor(preset.value)"
              >
                <span class="h-full w-full rounded-[7px]" :style="{ backgroundColor: normalizeHexColor(preset.value) || preset.value }"></span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </Popover>
  </BaseInput>
</template>

<style scoped>
.color-slider-track {
  overflow: hidden;
}

.color-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 28px;
  border: 1px solid rgb(var(--md-sys-color-outline) / 0.24);
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
}

.color-slider--hue {
  background: linear-gradient(
    to right,
    #ff0000 0%,
    #ffff00 16.66%,
    #00ff00 33.33%,
    #00ffff 50%,
    #0000ff 66.66%,
    #ff00ff 83.33%,
    #ff0000 100%
  );
}

.color-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #ffffff;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgb(var(--md-sys-color-on-surface) / 0.2);
}

.color-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid #ffffff;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgb(var(--md-sys-color-on-surface) / 0.2);
}
</style>
