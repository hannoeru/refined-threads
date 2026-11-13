// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { defaultSettings } from '../model'
import { addAccount } from '../rules/edit'
import { loadSettings, saveSettings, today, watchSettings } from '../settings'

const ITEM_LIMIT = 8192

function withHiddenAccounts(count: number) {
  const settings = defaultSettings()
  for (let index = 0; index < count; index++)
    settings.ruleFile = addAccount(settings.ruleFile, 'hidden-accounts', `spam_account_${index}`)
  return settings
}

describe('settings storage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.stubGlobal('browser', fakeBrowser)
  })

  it('keeps every sync item under the per-item limit, for long lists and Chinese words', async () => {
    const settings = withHiddenAccounts(2000)
    settings.ruleFile = addAccount(settings.ruleFile, 'hidden-accounts', 'amy')
    await saveSettings(settings)
    const items = await fakeBrowser.storage.sync.get(null)
    for (const [key, value] of Object.entries(items))
      expect(new TextEncoder().encode(key + JSON.stringify(value)).length).toBeLessThanOrEqual(ITEM_LIMIT)
    expect(await loadSettings()).toEqual(settings)
  })

  it('removes parts that a smaller save no longer uses', async () => {
    await saveSettings(withHiddenAccounts(500))
    const small = defaultSettings()
    await saveSettings(small)
    const keys = Object.keys(await fakeBrowser.storage.sync.get(null))
    expect(keys.filter(key => key.startsWith('settings_')).length).toBe(2)
    expect(await loadSettings()).toEqual(small)
  })

  it('tells watchers about a save once, with the saved settings', async () => {
    const seen: number[] = []
    const stop = watchSettings(settings => seen.push(settings.ruleFile.rules.length))
    await saveSettings(withHiddenAccounts(3))
    await vi.waitFor(() => expect(seen.length).toBe(1))
    stop()
  })

  it('falls back to the defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(defaultSettings())
  })
})

describe('today', () => {
  it('uses the local calendar day', () => {
    vi.stubEnv('TZ', 'Asia/Taipei')
    const local = new Date(2026, 10, 14, 0, 30)
    expect(today(local)).toBe('2026-11-14')
    vi.unstubAllEnvs()
  })
})
