import type { Settings } from '../model'
import * as v from 'valibot'
import { onScopeDispose, shallowRef } from 'vue'
import { SettingsSchema } from '../model'
import { loadSettings, saveSettings, watchSettings } from '../settings'

export type SaveError = 'save_invalid' | 'save_failed'

export function useSettings() {
  const settings = shallowRef<Settings | null>(null)
  const error = shallowRef<SaveError | null>(null)
  void loadSettings().then((loaded) => {
    settings.value ??= loaded
  })
  onScopeDispose(watchSettings(next => (settings.value = next)))

  let saving = Promise.resolve()

  async function apply(change: (current: Settings) => Settings): Promise<void> {
    const current = settings.value
    if (!current)
      return
    const result = v.safeParse(SettingsSchema, change(current))
    if (!result.success) {
      error.value = 'save_invalid'
      settings.value = { ...current }
      return
    }
    try {
      await saveSettings(result.output)
      settings.value = result.output
      error.value = null
    }
    catch {
      error.value = 'save_failed'
      settings.value = { ...current }
    }
  }

  function update(change: (current: Settings) => Settings): Promise<void> {
    saving = saving.then(() => apply(change))
    return saving
  }

  return { settings, error, update }
}
