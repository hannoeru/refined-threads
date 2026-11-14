import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureKey } from '../features/api'
import { FEATURES } from '../features/registry'
import { BUILT_IN_RULE_INPUTS, DISPLAYS, EFFECTS, FIELDS, LEVELS, TARGETS } from '../model'
import { PRESET_FILES } from '../share'
import { OPERATORS } from '../ui/ruleForm'

const root = join(__dirname, '..', '..')

function load(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(join(root, 'public', '_locales', locale, 'messages.json'), 'utf8'))
}

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__'
        ? []
        : sources(path)
    }
    return /\.(?:ts|vue)$/.test(entry.name)
      ? [
          readFileSync(join(root, path), 'utf8'),
        ]
      : []
  })
}

const snake = (id: string) => id.replaceAll('-', '_')

const code = [
  ...sources('src'),
  ...sources('entrypoints'),
  readFileSync(join(root, 'wxt.config.ts'), 'utf8'),
].join('\n')

function calledKeys(): string[] {
  return [
    ...code.matchAll(/\b(?:t|translate|getMessage)\('([a-z_A-Z]+)'/g),
    ...code.matchAll(/__MSG_(\w+)__/g),
  ].map(match => match[1]!)
}

function usedKeys(): Set<string> {
  const shown = BUILT_IN_RULE_INPUTS.filter(rule => rule.effect !== 'allow')
  return new Set([
    ...calledKeys(),
    ...LEVELS.flatMap(level => [`level_${level}`, `level_${level}_description`]),
    ...BUILT_IN_RULE_INPUTS.flatMap(rule => [`rule_${snake(rule.id)}`, `rule_${snake(rule.id)}_description`]),
    ...shown.map(rule => `reason_${snake(rule.id)}`),
    ...['new-accounts', 'few-followers', 'few-posts'].map(id => `threshold_${snake(id)}`),
    ...EFFECTS.map(effect => `effect_${effect}`),
    ...TARGETS.map(target => `target_${target}`),
    ...FIELDS.map(field => `field_${field.replaceAll('.', '_')}`),
    ...OPERATORS.flatMap(op => [`op_${op}`, `op_${op}_placeholder`]),
    ...DISPLAYS.flatMap(display => [`display_${display}`, `display_${display}_description`]),
    ...[
      'protection',
      'lists',
      'profile',
      'rules',
      'look',
      'presets',
    ].map(section => `section_${section}`),
    ...PRESET_FILES.flatMap(preset => [preset.name, preset.description]),
    ...FEATURES.flatMap(feature => [
      featureKey(feature.id, 'name'),
      featureKey(feature.id, 'description'),
      ...Object.entries(feature.options).flatMap(([key, spec]) => [
        featureKey(feature.id, `option_${key}`),
        ...(spec.type === 'select'
          ? spec.choices.map(choice => featureKey(feature.id, `option_${key}_${snake(choice)}`))
          : []),
      ]),
      ...Object.values(feature.shortcuts ?? {}).map(action => featureKey(feature.id, `shortcut_${action}`)),
    ]),
  ])
}

describe('locales', () => {
  const en = load('en')
  const zh = load('zh_TW')
  const used = usedKeys()
  const quoted = new Set([
    ...code.matchAll(/'([a-z]\w*)'/g),
  ].map(match => match[1]!))

  it('english and Traditional Chinese have the same keys', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  it('every key the code uses exists', () => {
    expect([...used].filter(key => key !== '@@ui_locale' && !(key in en))).toEqual([])
  })

  it('every key in the locale files is used', () => {
    expect(Object.keys(en).filter(key => !used.has(key) && !quoted.has(key))).toEqual([])
  })
})
