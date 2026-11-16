import type { Settings } from '../model'
import type { SharedFile } from '../share'
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../model'
import { addAccount, findRule, readList, writeList } from '../rules/edit'
import { ALL_PARTS, applyShared, exportSettings, linkPayload, partsOf, PRESET_FILES, readSharedFile, readSharedLink, sharedFile, shareLink } from '../share'

const mergeInto = (settings: Settings, file: SharedFile) => applyShared({ settings, features: {} }, file, ALL_PARTS, 'merge').settings

describe('sharing settings', () => {
  it('exports settings that import back to the same settings', () => {
    const settings = {
      ...defaultSettings(),
      level: 'strict' as const,
      tagOnly: true,
    }
    settings.ruleFile = addAccount(settings.ruleFile, 'hidden-accounts', 'spammer')
    const features = {
      'absolute-timestamps': {
        enabled: true,
        options: { style: 'iso' },
      },
      'account-info': { enabled: false },
    }
    const result = readSharedFile(exportSettings({ settings, features }, ALL_PARTS, 'My setup'))
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.file.name).toBe('My setup')
    expect(applyShared({
      settings: defaultSettings(),
      features: {
        'keyboard-navigation': { enabled: false },
      },
    }, result.file, ALL_PARTS, 'replace')).toEqual({ settings, features })
  })

  it('merges feature settings from a file, and leaves them alone when the file has none', () => {
    const mine = {
      'keyboard-navigation': { enabled: false },
      'account-info': { enabled: true },
    }
    const file = readSharedFile(JSON.stringify({
      format: 'refined-threads-settings',
      features: {
        'account-info': { enabled: false },
      },
    }))
    if (!file.ok)
      throw new Error('valid file')
    const settings = defaultSettings()
    expect(applyShared({ settings, features: mine }, file.file, ALL_PARTS, 'merge').features).toEqual({
      'keyboard-navigation': { enabled: false },
      'account-info': { enabled: false },
    })
    for (const preset of PRESET_FILES) {
      expect(applyShared({ settings, features: mine }, preset, ALL_PARTS, 'replace').features).toBe(mine)
      expect(applyShared({ settings, features: mine }, preset, ALL_PARTS, 'merge').features).toBe(mine)
    }
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
    expect(readList(merged.ruleFile, 'countries')).toEqual(['JP'])
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

  it('merges a shared list into my list instead of replacing it', () => {
    const mine = {
      ...defaultSettings(),
      ruleFile: addAccount(defaultSettings().ruleFile, 'hidden-accounts', 'mine'),
    }
    const theirs = {
      ...defaultSettings(),
      ruleFile: addAccount(defaultSettings().ruleFile, 'hidden-accounts', 'theirs'),
    }
    const file = parse(exportSettings({ settings: theirs, features: {} }, ['lists']))
    expect(readList(mergeInto(mine, file).ruleFile, 'hidden-accounts')).toEqual(['mine', 'theirs'])
  })
})

function parse(text: string): SharedFile {
  const result = readSharedFile(text)
  if (!result.ok)
    throw new Error(result.errors.join('\n'))
  return result.file
}

function friend(): { settings: Settings, features: Record<string, { enabled: boolean }> } {
  const base = defaultSettings()
  let ruleFile = writeList(base.ruleFile, 'blocked-words', ['giveaway'])
  ruleFile = {
    ...ruleFile,
    scoring: {
      posts: { tagAt: 5, hideAt: 9 },
      replies: { tagAt: 5, hideAt: 9 },
    },
    rules: [
      ...ruleFile.rules,
      {
        id: 'friend-rule',
        name: 'Friend',
        enabled: true,
        target: 'all',
        effect: 'hide',
        score: 1,
        when: {
          field: 'text',
          contains_any: ['x'],
        },
      },
    ],
  }
  return {
    settings: {
      ...base,
      level: 'strict',
      tagOnly: true,
      display: 'blur',
      ruleFile,
    },
    features: {
      'account-info': { enabled: false },
    },
  }
}

function me(): { settings: Settings, features: Record<string, { enabled: boolean }> } {
  const base = defaultSettings()
  return {
    settings: {
      ...base,
      ruleFile: addAccount(base.ruleFile, 'hidden-accounts', 'spammer'),
    },
    features: {
      'keyboard-navigation': { enabled: false },
    },
  }
}

describe('partial sharing', () => {
  it('exports only the chosen parts', () => {
    const lists = parse(exportSettings(friend(), ['lists']))
    expect(partsOf(lists)).toEqual(['lists'])
    expect(lists.features).toBeUndefined()
    expect(lists.settings.level).toBeUndefined()
    expect(lists.settings.ruleFile?.rules.map(rule => rule.id).sort()).toEqual([
      'allowed-accounts',
      'blocked-sites',
      'blocked-words',
      'countries',
      'hidden-accounts',
    ])

    const rest = parse(exportSettings(friend(), ['features', 'protection', 'rules']))
    expect(partsOf(rest)).toEqual(['features', 'protection', 'rules'])
    expect(rest.settings.ruleFile?.rules.map(rule => rule.id)).not.toContain('blocked-words')
    expect(rest.settings.ruleFile?.rules.map(rule => rule.id)).toContain('friend-rule')
    expect(rest.settings.ruleFile?.scoring.posts).toEqual({ tagAt: 5, hideAt: 9 })

    expect(partsOf(parse(exportSettings(friend(), [])))).toEqual([])
  })

  it('reads every part from an old full file', () => {
    const old = JSON.stringify({
      format: 'refined-threads-settings',
      features: {
        'account-info': { enabled: true },
      },
      settings: defaultSettings(),
    })
    const file = parse(old)
    expect(partsOf(file)).toEqual(ALL_PARTS)
    expect(applyShared(me(), file, ALL_PARTS, 'replace')).toEqual({
      settings: defaultSettings(),
      features: {
        'account-info': { enabled: true },
      },
    })
  })

  for (const mode of ['replace', 'merge'] as const) {
    it(`${mode} changes only the checked parts`, () => {
      const file = parse(exportSettings(friend(), ALL_PARTS))
      const current = me()

      const onlyLists = applyShared(current, file, ['lists'], mode)
      expect(onlyLists.features).toBe(current.features)
      expect(onlyLists.settings.level).toBe('balanced')
      expect(onlyLists.settings.tagOnly).toBe(false)
      expect(onlyLists.settings.ruleFile.scoring).toEqual(current.settings.ruleFile.scoring)
      expect(findRule(onlyLists.settings.ruleFile, 'friend-rule')).toBeUndefined()
      expect(readList(onlyLists.settings.ruleFile, 'blocked-words')).toEqual(['giveaway'])
      expect(readList(onlyLists.settings.ruleFile, 'hidden-accounts')).toEqual(mode === 'merge'
        ? ['spammer']
        : [])

      const noLists = applyShared(current, file, ['features', 'protection', 'rules'], mode)
      expect(readList(noLists.settings.ruleFile, 'hidden-accounts')).toEqual(['spammer'])
      expect(readList(noLists.settings.ruleFile, 'blocked-words')).toEqual([])
      expect(findRule(noLists.settings.ruleFile, 'friend-rule')?.name).toBe('Friend')
      expect(noLists.settings).toMatchObject({ level: 'strict', tagOnly: true, display: 'blur' })
      expect(noLists.features['account-info']).toEqual({ enabled: false })
      expect(noLists.features['keyboard-navigation']).toEqual(mode === 'merge'
        ? { enabled: false }
        : undefined)
    })
  }

  it('never changes a part that the file does not contain', () => {
    const file = parse(exportSettings(friend(), ['lists']))
    const current = me()
    const result = applyShared(current, file, ALL_PARTS, 'replace')
    expect(result.features).toBe(current.features)
    expect(result.settings.level).toBe(current.settings.level)
    expect(result.settings.ruleFile.rules.filter(rule => rule.id === 'affiliate-links')).toEqual(current.settings.ruleFile.rules.filter(rule => rule.id === 'affiliate-links'))
  })

  it('turns rules on or off for an imported protection level when the rules are not imported', () => {
    const file = parse(exportSettings(friend(), ['protection']))
    const result = applyShared(me(), file, ['protection'], 'merge')
    expect(result.settings.level).toBe('strict')
    expect(findRule(result.settings.ruleFile, 'ai-label')?.enabled).toBe(true)
  })
})

describe('settings links', () => {
  it('encodes a shared file into a threads.com link and decodes it back', async () => {
    const file = sharedFile(friend(), ['lists', 'protection'], 'Mine')
    const link = await shareLink(file)
    expect(link).toMatch(/^https:\/\/www\.threads\.com\/#refined-threads=[\w-]+$/)
    const payload = linkPayload(new URL(link).hash)
    expect(payload).not.toBeNull()
    const result = await readSharedLink(payload!)
    expect(result).toEqual({
      ok: true,
      file: parse(JSON.stringify(file)),
    })
  })

  it('reports a damaged or unknown payload as an error', async () => {
    const payload = linkPayload(new URL(await shareLink(sharedFile(friend(), ALL_PARTS))).hash)!
    expect(await readSharedLink(payload.slice(0, 20))).toEqual({
      ok: false,
      errors: ['not-link'],
    })
    expect(await readSharedLink('a')).toEqual({
      ok: false,
      errors: ['not-link'],
    })
    const tooNew = linkPayload(new URL(await shareLink({
      format: 'refined-threads-settings',
      settings: {
        ruleFile: { version: 2 as never },
      },
    })).hash)!
    const result = await readSharedLink(tooNew)
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors[0]).toMatch(/^settings\.ruleFile\.version: /)
  })

  it('finds the payload only in a settings link fragment', () => {
    expect(linkPayload('#refined-threads=abc_-09')).toBe('abc_-09')
    expect(linkPayload('')).toBeNull()
    expect(linkPayload('#refined-threads=')).toBeNull()
    expect(linkPayload('#other=abc')).toBeNull()
    expect(linkPayload('#refined-threads=a+b')).toBeNull()
    expect(linkPayload('#x&refined-threads=abc')).toBeNull()
  })
})
