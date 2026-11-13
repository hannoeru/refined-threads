<script setup vapor lang="ts">
import type { Level, Stats } from '../../src/model'
import { computed, shallowRef } from 'vue'
import { featureKey } from '../../src/features/api'
import { FEATURES } from '../../src/features/registry'
import { applyLevel, ruleLabel } from '../../src/rules/edit'
import { statsItem, today } from '../../src/settings'
import LevelPicker from '../../src/ui/components/LevelPicker.vue'
import Toggle from '../../src/ui/components/Toggle.vue'
import { t } from '../../src/ui/i18n'
import { ISSUES_URL } from '../../src/ui/links'
import { useFeatures } from '../../src/ui/useFeatures'
import { useSettings } from '../../src/ui/useSettings'

const { settings, update } = useSettings()
const stats = shallowRef<Stats | null>(null)
void statsItem.getValue().then(value => (stats.value = value))
statsItem.watch(value => (stats.value = value))

const todayStats = computed(() => (stats.value?.day === today()
  ? stats.value
  : {
      day: today(),
      hidden: 0,
      tagged: 0,
      byRule: {},
    }))
const topRules = computed(() =>
  Object.entries(todayStats.value.byRule)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      count,
      label: ruleLabel({ id, name: settings.value?.ruleFile.rules.find(rule => rule.id === id)?.name ?? '' }, t),
    })),
)

const features = useFeatures()
const enabled = computed(() => features.states.value?.['spam-filter']?.enabled ?? true)
const level = computed({
  get: () => settings.value?.level ?? 'balanced',
  set: (value: Level) => void update(current => ({
    ...current,
    level: value,
    ruleFile: applyLevel(current.ruleFile, value),
  })),
})

const openSettings = () => void browser.runtime.openOptionsPage()
function openSpamSettings() {
  return void browser.tabs.create({
    url: browser.runtime.getURL('/options.html#feature/spam-filter'),
  })
}
const report = () => void browser.tabs.create({ url: ISSUES_URL })
</script>

<template>
  <main class="popup">
    <header class="popup-header">
      <img src="/icon/48.png" alt="" width="28" height="28">
      <h1>{{ t('extName') }}</h1>
    </header>

    <section class="spam" :class="{ off: !enabled }" aria-live="polite">
      <div class="spam-count">
        <p class="spam-number">
          {{ todayStats.hidden }}
        </p>
        <div>
          <p class="spam-label">
            {{ t('hidden_today') }}
          </p>
          <p v-if="todayStats.tagged" class="muted small">
            {{ t('tagged_today', [String(todayStats.tagged)]) }}
          </p>
        </div>
      </div>
      <ul v-if="topRules.length" class="top-rules">
        <li v-for="rule in topRules" :key="rule.id">
          <span>{{ rule.label }}</span>
          <span class="muted">{{ rule.count }}</span>
        </li>
      </ul>
      <LevelPicker v-model="level" compact />
      <p v-if="settings?.tagOnly" class="tag-only-note">
        {{ t('tag_only_active') }}
      </p>
      <button type="button" class="link-button" @click="openSpamSettings">
        {{ t('spam_filter_settings') }}
      </button>
    </section>

    <section class="features" :aria-label="t('features_title')">
      <h2>{{ t('features_title') }}</h2>
      <Toggle
        v-for="feature in FEATURES"
        :key="feature.id"
        :model-value="features.states.value?.[feature.id]?.enabled ?? feature.enabledByDefault"
        :label="t(featureKey(feature.id, 'name'))"
        @update:model-value="(value: boolean) => features.setEnabled(feature.id, value)"
      />
    </section>

    <footer class="popup-footer">
      <button type="button" class="button primary" @click="openSettings">
        {{ t('open_settings') }}
      </button>
      <button type="button" class="button" @click="report">
        {{ t('report_problem') }}
      </button>
    </footer>
  </main>
</template>

<style>
body {
  width: 340px;
}
.popup {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.popup-header img {
  border-radius: 7px;
}
.popup-header h1 {
  font-size: 16px;
}
.spam {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  transition: opacity 0.15s;
}
.spam.off {
  opacity: 0.5;
}
.spam-count {
  display: flex;
  align-items: center;
  gap: 12px;
}
.spam-number {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.spam-label {
  font-weight: 600;
}
.small {
  font-size: 13px;
}
.top-rules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.top-rules li {
  display: flex;
  justify-content: space-between;
}
.tag-only-note {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}
.link-button {
  align-self: flex-start;
  border: 0;
  background: none;
  padding: 0;
  color: var(--muted);
  font-weight: 600;
  font-size: 13px;
}
.link-button:hover {
  color: var(--ink);
}
.features {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.features h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.features .toggle-label {
  font-weight: 500;
}
.popup-footer {
  display: flex;
  gap: 8px;
}
.popup-footer .button {
  flex: 1;
}
</style>
