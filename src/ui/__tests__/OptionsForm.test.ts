import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVaporApp } from 'vue'
// @vitest-environment happy-dom
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { defineFeature } from '../../features/api'
import OptionsForm from '../components/OptionsForm.vue'

const feature = defineFeature({
  id: 'demo',
  enabledByDefault: true,
  options: {
    flag: { type: 'boolean', default: false },
    mode: {
      type: 'select',
      default: 'a',
      choices: ['a', 'b'],
    },
    size: {
      type: 'number',
      default: 2,
      min: 1,
      max: 9,
    },
  },
  init: () => undefined,
})

beforeEach(() => {
  vi.stubGlobal('browser', fakeBrowser)
  fakeBrowser.i18n.getMessage = ((key: string) => key) as never
  document.body.innerHTML = '<div id="app"></div>'
})

describe('optionsForm', () => {
  it('reports each changed option with its key and typed value', () => {
    const changes: [string, unknown][] = []
    createVaporApp(OptionsForm, {
      feature: () => feature,
      values: () => ({ flag: false, mode: 'a', size: 2 }),
      onChange: () => (key: string, value: unknown) => changes.push([key, value]),
    }).mount('#app')
    const checkbox = document.querySelector<HTMLInputElement>('input[type=checkbox]')!
    checkbox.click()
    const select = document.querySelector('select')!
    select.value = 'b'
    select.dispatchEvent(new Event('change'))
    const number = document.querySelector<HTMLInputElement>('input[type=number]')!
    number.value = '5'
    number.dispatchEvent(new Event('change'))
    expect(changes).toEqual([
      ['flag', true],
      ['mode', 'b'],
      ['size', 5],
    ])
  })
})
