import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureKey, resolveOptions } from '../api'
import { FEATURES } from '../registry'

const root = join(__dirname, '..', '..', '..')
function messages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, 'public', '_locales', locale, 'messages.json'), 'utf8'))
}

describe('feature registry', () => {
  const folders = readdirSync(join(__dirname, '..'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_') && !['__tests__', 'services'].includes(entry.name))
    .map(entry => entry.name)
    .sort()

  it('registers one feature per folder, with the folder name as its id', () => {
    expect(FEATURES.map(feature => feature.id)).toEqual(folders)
  })

  it.each(FEATURES.map(feature => [feature.id, feature] as const))('%s has valid defaults and every text in both languages', (id, feature) => {
    expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    const defaults = Object.fromEntries(Object.entries(feature.options).map(([key, spec]) => [key, spec.default]))
    expect(resolveOptions(feature.options, defaults)).toEqual(defaults)
    const keys = [
      featureKey(id, 'name'),
      featureKey(id, 'description'),
    ]
    for (const [key, spec] of Object.entries(feature.options)) {
      keys.push(featureKey(id, `option_${key}`))
      if (spec.type === 'select') {
        for (const choice of spec.choices) keys.push(featureKey(id, `option_${key}_${choice.replaceAll('-', '_')}`))
      }
    }
    for (const action of Object.values(feature.shortcuts ?? {})) keys.push(featureKey(id, `shortcut_${action}`))
    for (const locale of ['en', 'zh_TW']) {
      const missing = keys.filter(key => !(key in messages(locale)))
      expect(missing, locale).toEqual([])
    }
  })
})
