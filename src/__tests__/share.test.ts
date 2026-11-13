import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../model'
import { addAccount, findRule, readList } from '../rules/edit'
import { exportSettings, mergeInto, PRESET_FILES, readSharedFile, replaceWith } from '../share'

describe('sharing settings', () => {
  it('exports settings that import back to the same settings', () => {
    const settings = {
      ...defaultSettings(),
      level: 'strict' as const,
      tagOnly: true,
    }
    settings.ruleFile = addAccount(settings.ruleFile, 'hidden-accounts', 'spammer')
    const result = readSharedFile(exportSettings(settings, 'My setup'))
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.file.name).toBe('My setup')
    expect(replaceWith(result.file)).toEqual(settings)
  })

  it('reports plain errors for files that are not settings', () => {
    expect(readSharedFile('{nope')).toEqual({
      ok: false,
      errors: ['not-json'],
    })
    const wrong = readSharedFile(JSON.stringify({
      format: 'refined-threads-settings',
      settings: { level: 'extreme' },
    }))
    expect(wrong.ok).toBe(false)
    if (!wrong.ok)
      expect(wrong.errors[0]).toMatch(/^settings\.level: /)
  })

  it('merges rules by id and keeps the rest of my rules', () => {
    const mine = {
      ...defaultSettings(),
      ruleFile: addAccount(defaultSettings().ruleFile, 'hidden-accounts', 'spammer'),
    }
    const shared = {
      format: 'refined-threads-settings' as const,
      name: '',
      description: '',
      settings: {
        ruleFile: {
          version: 1 as const,
          scoring: mine.ruleFile.scoring,
          rules: [
            {
              id: 'countries',
              name: '',
              enabled: true,
              target: 'all' as const,
              effect: 'tag' as const,
              score: 1,
              when: {
                field: 'author.country' as const,
                in: ['JP'],
              },
            },
            {
              id: 'mine-new',
              name: 'New one',
              enabled: true,
              target: 'replies' as const,
              effect: 'hide' as const,
              score: 1,
              when: {
                field: 'text' as const,
                contains_any: ['x'],
              },
            },
          ],
        },
      },
    }
    const merged = mergeInto(mine, shared)
    expect(readList(merged.ruleFile, 'hidden-accounts')).toEqual(['spammer'])
    expect(findRule(merged.ruleFile, 'countries')?.effect).toBe('tag')
    expect(findRule(merged.ruleFile, 'mine-new')?.name).toBe('New one')
    expect(merged.ruleFile.rules).toHaveLength(mine.ruleFile.rules.length + 1)
  })

  it('every built-in preset is a valid shared file that merges cleanly', () => {
    for (const preset of PRESET_FILES) {
      const { id: _id, ...file } = preset
      const result = readSharedFile(JSON.stringify(file))
      expect(result.ok, preset.id).toBe(true)
      expect(() => mergeInto(defaultSettings(), file)).not.toThrow()
    }
    const testMode = PRESET_FILES.find(preset => preset.id === 'test-mode')!
    expect(mergeInto(defaultSettings(), testMode).tagOnly).toBe(true)
  })
})
