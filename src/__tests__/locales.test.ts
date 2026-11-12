import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_IDS, DISPLAYS, EFFECTS, FIELDS, LEVELS, TARGETS } from '../model'
import { PRESET_FILES } from '../share'

const root = join(__dirname, '..', '..')
const load = (locale: string): Record<string, { message: string }> =>
  JSON.parse(readFileSync(join(root, 'public', '_locales', locale, 'messages.json'), 'utf8'))

const sources = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.(ts|vue)$/.test(entry.name) ? [readFileSync(join(root, path), 'utf8')] : []
  })

const snake = (id: string) => id.replaceAll('-', '_')

describe('locales', () => {
  const en = load('en')
  const zh = load('zh_TW')

  it('English and Traditional Chinese have the same keys', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  it('every key the code uses exists', () => {
    const code = [...sources('src'), ...sources('entrypoints')].join('\n')
    const staticKeys = [...code.matchAll(/\bt\('([a-z_A-Z]+)'/g), ...code.matchAll(/translate\('([a-z_]+)'/g), ...code.matchAll(/getMessage\('([a-z_]+)'/g)].map((match) => match[1]!)
    const dynamicKeys = [
      ...LEVELS.flatMap((level) => [`level_${level}`, `level_${level}_description`]),
      ...BUILT_IN_IDS.flatMap((id) => [`rule_${snake(id)}`, `rule_${snake(id)}_description`]),
      ...['new-accounts', 'few-followers', 'few-posts'].map((id) => `threshold_${snake(id)}`),
      ...EFFECTS.map((effect) => `effect_${effect}`),
      ...TARGETS.map((target) => `target_${target}`),
      ...FIELDS.map((field) => `field_${field.replaceAll('.', '_')}`),
      ...['contains_any', 'in', 'matches', 'host_in', 'is', 'gt', 'lt'].flatMap((op) => [`op_${op}`, `op_${op}_placeholder`]),
      ...DISPLAYS.flatMap((display) => [`display_${display}`, `display_${display}_description`]),
      ...['protection', 'lists', 'profile', 'rules', 'look', 'share'].map((section) => `section_${section}`),
      ...PRESET_FILES.flatMap((preset) => [preset.name, preset.description]),
    ]
    const missing = [...new Set([...staticKeys, ...dynamicKeys])].filter((key) => key !== '@@ui_locale' && !(key in en))
    expect(missing).toEqual([])
  })
})
