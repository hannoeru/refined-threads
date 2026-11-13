<script setup vapor lang="ts">
import type { Level } from '../../src/model'
import { computed } from 'vue'
import { applyLevel } from '../../src/rules/edit'
import LevelPicker from '../../src/ui/components/LevelPicker.vue'
import { t } from '../../src/ui/i18n'
import { THREADS_URL } from '../../src/ui/links'
import { useSettings } from '../../src/ui/useSettings'

const { settings, update } = useSettings()
const level = computed({
  get: () => settings.value?.level ?? 'balanced',
  set: (value: Level) => void update(current => ({
    ...current,
    level: value,
    ruleFile: applyLevel(current.ruleFile, value),
  })),
})
const openThreads = () => void browser.tabs.create({ url: THREADS_URL })
const openSettings = () => void browser.runtime.openOptionsPage()
const featuresUrl = browser.runtime.getURL('/options.html#features')
</script>

<template>
  <main class="welcome">
    <img class="welcome-icon" src="/icon/128.png" alt="" width="96" height="96">
    <h1>{{ t('welcome_title') }}</h1>
    <p class="welcome-lead">
      {{ t('welcome_lead') }}
    </p>
    <LevelPicker v-model="level" />
    <p class="muted">
      {{ t('welcome_privacy') }}
    </p>
    <p class="welcome-more">
      {{ t('welcome_more') }} <a :href="featuresUrl">{{ t('welcome_more_link') }}</a>
    </p>
    <div class="welcome-actions">
      <button type="button" class="button primary" @click="openThreads">
        {{ t('open_threads') }}
      </button>
      <button type="button" class="button" @click="openSettings">
        {{ t('open_settings') }}
      </button>
    </div>
  </main>
</template>

<style>
.welcome {
  max-width: 680px;
  margin: 0 auto;
  padding: 64px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.welcome-icon {
  border-radius: 22px;
}
.welcome h1 {
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 800;
  letter-spacing: -0.01em;
}
.welcome-lead {
  font-size: 18px;
  max-width: 56ch;
}
.welcome-more {
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
}
.welcome-more a {
  color: var(--link);
  font-weight: 600;
  text-decoration: none;
}
.welcome-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
