import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { defaultSettings, LEVEL_PRESETS, RuleFileSchema } from '../model'

describe('settings model', () => {
  it('defaults to balanced protection, collapse display, and the balanced presets', () => {
    const settings = defaultSettings()
    expect(settings.enabled).toBe(true)
    expect(settings.level).toBe('balanced')
    expect(settings.display).toBe('collapse')
    expect(settings.ruleFile.presets).toEqual(LEVEL_PRESETS.balanced)
  })

  it('normalizes account handles to lower case and rejects unknown fields', () => {
    const file = v.parse(RuleFileSchema, { version: 1, hiddenAccounts: [' SpamBot_1 '] })
    expect(file.hiddenAccounts).toEqual(['spambot_1'])
    expect(v.safeParse(RuleFileSchema, { version: 1, script: 'alert(1)' }).success).toBe(false)
  })
})
