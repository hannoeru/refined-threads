<script setup vapor lang="ts">
import { computed, shallowRef } from 'vue'
import type { Level, Stats } from '../../src/model'
import { applyLevel, ruleLabel } from '../../src/rules/edit'
import { statsItem, today } from '../../src/settings'
import LevelPicker from '../../src/ui/components/LevelPicker.vue'
import Toggle from '../../src/ui/components/Toggle.vue'
import { t } from '../../src/ui/i18n'
import { ISSUES_URL } from '../../src/ui/links'
import { useSettings } from '../../src/ui/useSettings'

const { settings, update } = useSettings()
const stats = shallowRef<Stats | null>(null)
void statsItem.getValue().then((value) => (stats.value = value))
statsItem.watch((value) => (stats.value = value))

const todayStats = computed(() => (stats.value?.day === today() ? stats.value : { day: today(), hidden: 0, tagged: 0, byRule: {} }))
const topRules = computed(() =>
  Object.entries(todayStats.value.byRule)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, count]) => ({ id, count, label: ruleLabel({ id, name: settings.value?.ruleFile.rules.find((rule) => rule.id === id)?.name ?? '' }, t) })),
)
const specks = computed(() => Array.from({ length: Math.min(todayStats.value.hidden + todayStats.value.tagged, 18) }, (_, index) => index))

const enabled = computed({
  get: () => settings.value?.enabled ?? true,
  set: (value: boolean) => void update((current) => ({ ...current, enabled: value })),
})
const level = computed({
  get: () => settings.value?.level ?? 'balanced',
  set: (value: Level) => void update((current) => ({ ...current, level: value, ruleFile: applyLevel(current.ruleFile, value) })),
})

const openSettings = () => void browser.runtime.openOptionsPage()
const report = () => void browser.tabs.create({ url: ISSUES_URL })
</script>

<template>
  <main class="popup">
    <header class="popup-header">
      <img src="/icon/48.png" alt="" width="32" height="32" />
      <h1>{{ t('extName') }}</h1>
    </header>
    <Toggle v-model="enabled" :label="enabled ? t('protection_on') : t('protection_off')" />
    <section class="sheet" :class="{ off: !enabled }" aria-live="polite">
      <div class="sheet-specks" aria-hidden="true">
        <span v-for="speck in specks" :key="speck" class="speck" :style="{ '--i': speck }" />
      </div>
      <p class="sheet-count">{{ todayStats.hidden }}</p>
      <p class="sheet-label">{{ t('hidden_today') }}</p>
      <p v-if="todayStats.tagged" class="sheet-tagged muted">{{ t('tagged_today', [String(todayStats.tagged)]) }}</p>
    </section>
    <ul v-if="topRules.length" class="top-rules">
      <li v-for="rule in topRules" :key="rule.id">
        <span>{{ rule.label }}</span>
        <span class="muted">{{ rule.count }}</span>
      </li>
    </ul>
    <LevelPicker v-model="level" compact />
    <p v-if="settings?.tagOnly" class="tag-only-note">{{ t('tag_only_active') }}</p>
    <footer class="popup-footer">
      <button type="button" class="button primary" @click="openSettings">{{ t('open_settings') }}</button>
      <button type="button" class="button" @click="report">{{ t('report_problem') }}</button>
    </footer>
  </main>
</template>

<style>
body { width: 340px; }
.popup { display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.popup-header { display: flex; align-items: center; gap: 10px; }
.popup-header h1 { font-size: 17px; }
.sheet { position: relative; overflow: hidden; padding: 18px 16px 14px; border-radius: 18px; background: var(--surface);
  border: 1px solid var(--line); background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 9px 9px; }
.sheet.off { opacity: 0.55; }
.sheet-count { font-family: var(--heading); font-size: 44px; font-weight: 800; line-height: 1; color: var(--roller); }
.sheet-label { font-weight: 600; }
.sheet-tagged { font-size: 13px; }
.sheet-specks { position: absolute; inset: 10px 12px auto auto; width: 120px; height: 56px; }
.speck { position: absolute; width: 7px; height: 4px; border-radius: 3px; background: var(--lint);
  left: calc(mod(var(--i) * 37, 110) * 1px); top: calc(mod(var(--i) * 23, 50) * 1px); transform: rotate(calc(var(--i) * 41deg)); }
.top-rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.top-rules li { display: flex; justify-content: space-between; }
.tag-only-note { font-size: 13px; padding: 8px 10px; border-radius: var(--radius-sm); background: rgba(166, 226, 46, 0.18); }
.popup-footer { display: flex; gap: 8px; }
.popup-footer .button { flex: 1; }
</style>
