import { onScopeDispose, shallowRef } from 'vue'
import type { Settings } from '../model'
import { loadSettings, saveSettings, watchSettings } from '../settings'

export function useSettings() {
  const settings = shallowRef<Settings | null>(null)
  void loadSettings().then((loaded) => {
    settings.value ??= loaded
  })
  onScopeDispose(watchSettings((next) => (settings.value = next)))

  async function update(change: (current: Settings) => Settings): Promise<void> {
    if (!settings.value) return
    const next = change(settings.value)
    settings.value = next
    await saveSettings(next)
  }

  return { settings, update }
}
