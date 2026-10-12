import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TextareaInput from '../TextareaInput.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(component: Parameters<typeof mountCore>[0]) {
  const view = mountCore(component, {})
  mounted.push(view)
  return view
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('TextareaInput native attributes', () => {
  it('routes native attributes and events to the textarea and styling to the wrapper', async () => {
    const model = ref<string | number | undefined>('Draft')
    const inputEvent = vi.fn()
    const validationTouch = vi.fn()
    const view = mount(defineComponent({
      setup: () => () => h('div', [
        h(TextareaInput, {
          id: 'message-body',
          name: 'messageBody',
          maxlength: 80,
          autocomplete: 'off',
          rows: 5,
          placeholder: 'Write a message',
          'aria-label': 'Message body',
          'aria-describedby': 'message-hint',
          'data-control': 'message',
          class: 'message-wrapper',
          style: { marginTop: '4px' },
          helperMessage: 'Keep the message short.',
          error: 'Message contains an invalid value.',
          required: true,
          modelValue: model.value,
          'onUpdate:modelValue': (value: string | number | undefined) => { model.value = value },
          onInput: inputEvent,
          'onValidation:touch': validationTouch,
        }),
        h(TextareaInput, {
          id: 'locked-message',
          disabled: true,
          required: true,
          modelValue: '',
        }),
      ]),
    }))
    await flush()

    const textarea = view.find<HTMLTextAreaElement>('#message-body')
    expect(textarea).not.toBeNull()
    expect(textarea!.name).toBe('messageBody')
    expect(textarea!.maxLength).toBe(80)
    expect(textarea!.autocomplete).toBe('off')
    expect(textarea!.rows).toBe(5)
    expect(textarea!.placeholder).toBe('Write a message')
    expect(textarea!.getAttribute('aria-label')).toBe('Message body')
    expect(textarea!.getAttribute('data-control')).toBe('message')
    expect(textarea!.required).toBe(true)
    expect(textarea!.disabled).toBe(false)
    expect(textarea!.classList.contains('message-wrapper')).toBe(false)

    const describedBy = textarea!.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    expect(describedBy).toContain('message-hint')
    expect(describedBy.map((id) => view.find(`#${id}`)?.textContent?.trim())).toContain('Keep the message short.')
    expect(describedBy.map((id) => view.find(`#${id}`)?.textContent?.trim())).toContain('Message contains an invalid value.')
    expect(textarea!.closest('.message-wrapper')?.style.marginTop).toBe('4px')

    textarea!.value = 'Updated message'
    textarea!.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Updated message' }))
    await flush()
    expect(model.value).toBe('Updated message')
    expect(inputEvent).toHaveBeenCalledOnce()

    const outside = document.createElement('button')
    document.body.append(outside)
    textarea!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    expect(validationTouch).toHaveBeenCalledOnce()
    outside.remove()

    const locked = view.find<HTMLTextAreaElement>('#locked-message')
    expect(locked?.disabled).toBe(true)
    expect(locked?.required).toBe(true)
  })
})
