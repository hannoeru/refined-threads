import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_IDS, defaultSettings, RuleFileSchema, SettingsSchema } from '../model'

describe('settings model', () => {
  it('defaults to balanced protection that hides, with every built-in rule present', () => {
    const settings = defaultSettings()
    expect(settings).toMatchObject({ enabled: true, level: 'balanced', tagOnly: false, display: 'collapse' })
    expect(settings.ruleFile.rules.map((rule) => rule.id)).toEqual(BUILT_IN_IDS)
    expect(settings.ruleFile.scoring).toEqual({ posts: { tagAt: 2, hideAt: 3 }, replies: { tagAt: 2, hideAt: 3 } })
  })

  it('accepts a minimal custom rule and fills its defaults', () => {
    const file = v.parse(RuleFileSchema, { version: 1, rules: [{ id: 'mine', when: { field: 'text', contains_any: ['x'] } }] })
    expect(file.rules[0]).toEqual({ id: 'mine', name: '', enabled: true, target: 'all', effect: 'score', score: 1, when: { field: 'text', contains_any: ['x'] } })
  })

  it('rejects unknown fields, unknown condition fields, and scripts', () => {
    expect(v.safeParse(RuleFileSchema, { version: 1, script: 'alert(1)' }).success).toBe(false)
    expect(v.safeParse(RuleFileSchema, { version: 1, rules: [{ id: 'x', when: { field: 'author.password', is: 'x' } }] }).success).toBe(false)
    expect(v.safeParse(SettingsSchema, { level: 'extreme' }).success).toBe(false)
  })
})
