import type { Settings, Stats } from './model'
import * as v from 'valibot'
import { storage } from '#imports'
import { defaultSettings, SettingsSchema } from './model'

export const settingsItem = storage.defineItem<unknown>('sync:settings', { fallback: null })

export async function loadSettings(): Promise<Settings> {
  const result = v.safeParse(SettingsSchema, await settingsItem.getValue())
  return result.success
    ? result.output
    : defaultSettings()
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue(v.parse(SettingsSchema, settings))
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => {
    const result = v.safeParse(SettingsSchema, value)
    callback(result.success
      ? result.output
      : defaultSettings())
  })
}

export const today = (): string => new Date().toISOString().slice(0, 10)

export const statsItem = storage.defineItem<Stats>('local:stats', {
  fallback: {
    day: '',
    hidden: 0,
    tagged: 0,
    byRule: {},
  },
})
