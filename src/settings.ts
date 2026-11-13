import type { Settings, Stats } from './model'
import * as v from 'valibot'
import { browser, storage } from '#imports'
import { defaultSettings, SettingsSchema } from './model'

const COUNT_KEY = 'settings'
const PART_PREFIX = 'settings_'
// storage.sync allows 8192 bytes per item. One UTF-16 unit takes at most 3 bytes in a stored JSON string.
const PART_LENGTH = 2500

const isSettingsKey = (key: string) => key === COUNT_KEY || key.startsWith(PART_PREFIX)

function join(items: Record<string, unknown>): Settings {
  const count = items[COUNT_KEY]
  if (typeof count !== 'number')
    return defaultSettings()
  const parts = Array.from({ length: count }, (_, index) => items[`${PART_PREFIX}${index}`])
  if (!parts.every(part => typeof part === 'string'))
    return defaultSettings()
  try {
    const result = v.safeParse(SettingsSchema, JSON.parse(parts.join('')))
    return result.success
      ? result.output
      : defaultSettings()
  }
  catch {
    return defaultSettings()
  }
}

export async function loadSettings(): Promise<Settings> {
  return join(await browser.storage.sync.get(null))
}

export async function saveSettings(settings: Settings): Promise<void> {
  const text = JSON.stringify(v.parse(SettingsSchema, settings))
  const items: Record<string, unknown> = {}
  for (let index = 0; index * PART_LENGTH < text.length; index++)
    items[`${PART_PREFIX}${index}`] = text.slice(index * PART_LENGTH, (index + 1) * PART_LENGTH)
  const count = Object.keys(items).length
  items[COUNT_KEY] = count
  await browser.storage.sync.set(items)
  const stale = Object.keys(await browser.storage.sync.get(null)).filter(key => key.startsWith(PART_PREFIX) && Number(key.slice(PART_PREFIX.length)) >= count)
  if (stale.length > 0)
    await browser.storage.sync.remove(stale)
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'sync' && Object.entries(changes).some(([key, change]) => isSettingsKey(key) && change.newValue !== undefined))
      void loadSettings().then(callback)
  }
  browser.storage.onChanged.addListener(listener)
  return () => browser.storage.onChanged.removeListener(listener)
}

export function today(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const statsItem = storage.defineItem<Stats>('local:stats', {
  fallback: {
    day: '',
    hidden: 0,
    tagged: 0,
    byRule: {},
  },
})
