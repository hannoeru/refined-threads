<script setup vapor lang="ts">
import { computed, ref } from 'vue'
import { featureKey } from '../../src/features/api'
import { featureById, FEATURES } from '../../src/features/registry'
import { settingsPage } from '../../src/features/settings-pages'
import OptionsForm from '../../src/ui/components/OptionsForm.vue'
import Toggle from '../../src/ui/components/Toggle.vue'
import { t } from '../../src/ui/i18n'
import { useFeatures } from '../../src/ui/useFeatures'

const route = ref(location.hash.slice(1))
window.addEventListener('hashchange', () => (route.value = location.hash.slice(1)))

const current = computed(() => {
  const match = route.value.match(/^feature\/([a-z0-9-]+)$/)
  return match?.[1]
    ? featureById(match[1])
    : undefined
})

const query = ref('')
const { states, setEnabled, setOption } = useFeatures()

const name = (id: string) => t(featureKey(id, 'name'))
const description = (id: string) => t(featureKey(id, 'description'))
const hasSettings = (id: string) => Object.keys(featureById(id)?.options ?? {}).length > 0 || settingsPage(id) !== undefined

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return FEATURES.filter(feature => !needle || `${feature.id} ${name(feature.id)} ${description(feature.id)}`.toLowerCase().includes(needle))
})
const page = computed(() => (current.value
  ? settingsPage(current.value.id)
  : undefined))
</script>

<template>
  <div class="options">
    <nav class="options-nav" :aria-label="t('settings_title')">
      <a class="brand" href="#features">
        <img src="/icon/48.png" alt="" width="32" height="32">
        <span>{{ t('extName') }}</span>
      </a>
      <a class="nav-item" href="#features" :aria-current="!current ? 'page' : undefined">{{ t('features_title') }}</a>
      <a
        v-for="feature in FEATURES"
        :key="feature.id"
        class="nav-item nav-feature"
        :href="`#feature/${feature.id}`"
        :aria-current="current?.id === feature.id ? 'page' : undefined"
      >
        <span class="dot" :class="{ on: states?.[feature.id]?.enabled }" aria-hidden="true" />
        {{ name(feature.id) }}
      </a>
    </nav>

    <main v-if="states" class="options-main">
      <section v-if="!current" class="section">
        <h2>{{ t('features_title') }}</h2>
        <p class="muted">
          {{ t('features_intro') }}
        </p>
        <input v-model="query" class="field" type="search" :placeholder="t('features_search')" :aria-label="t('features_search')">
        <ul class="feature-list">
          <li v-for="feature in visible" :key="feature.id" class="feature-row">
            <Toggle
              :model-value="states[feature.id]!.enabled"
              :label="name(feature.id)"
              :description="description(feature.id)"
              @update:model-value="(value: boolean) => setEnabled(feature.id, value)"
            />
            <a v-if="hasSettings(feature.id)" class="button" :href="`#feature/${feature.id}`">{{ t('feature_settings') }}</a>
          </li>
        </ul>
        <p v-if="visible.length === 0" class="muted">
          {{ t('features_none') }}
        </p>
      </section>

      <section v-else class="section">
        <a class="back" href="#features">{{ t('features_back') }}</a>
        <div class="card">
          <Toggle
            :model-value="states[current.id]!.enabled"
            :label="name(current.id)"
            :description="description(current.id)"
            @update:model-value="(value: boolean) => setEnabled(current!.id, value)"
          />
          <ul v-if="current.shortcuts" class="shortcuts">
            <li v-for="(action, key) in current.shortcuts" :key="key">
              <kbd>{{ key }}</kbd>
              <span>{{ t(featureKey(current.id, `shortcut_${action}`)) }}</span>
            </li>
          </ul>
        </div>
        <OptionsForm :feature="current" :values="states[current.id]!.options" @change="(key: string, value: unknown) => setOption(current!.id, key, value)" />
        <component :is="page" v-if="page" />
      </section>
    </main>
  </div>
</template>

<style>
.options {
  display: grid;
  grid-template-columns: 220px minmax(0, 760px);
  gap: 32px;
  padding: 32px 24px;
  max-width: 1060px;
  margin: 0 auto;
}
.options-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 32px;
  align-self: start;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  margin-bottom: 20px;
  font-weight: 700;
  font-size: 17px;
  color: inherit;
  text-decoration: none;
}
.brand img {
  border-radius: 8px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
}
.nav-item:hover {
  background: var(--accent-soft);
  color: var(--ink);
}
.nav-item[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}
.nav-feature {
  font-size: 14px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line);
  flex: none;
}
.dot.on {
  background: var(--ink);
}
.options-main {
  min-width: 0;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-column);
}
.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section h2 {
  font-size: 22px;
}
.section h3 {
  font-size: 16px;
}
.back {
  align-self: flex-start;
  color: var(--muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}
.back:hover {
  color: var(--ink);
}
.back::before {
  content: '‹ ';
}
.feature-list {
  list-style: none;
  margin: 0 -24px;
  padding: 0;
  border-top: 1px solid var(--hairline);
}
.feature-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--hairline);
}
.feature-row:last-child {
  border-bottom: 0;
}
.feature-row .toggle {
  flex: 1;
}
.feature-row .button {
  white-space: nowrap;
}
.shortcuts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.shortcuts li {
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--muted);
}
kbd {
  min-width: 26px;
  text-align: center;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-bottom-width: 2px;
  border-radius: 6px;
  color: var(--ink);
  font:
    600 12px/18px ui-monospace,
    Menlo,
    monospace;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--hairline);
}
.row:last-child {
  border-bottom: 0;
}
.row .toggle {
  flex: 1 1 300px;
}
.inline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.inline.end {
  justify-content: flex-end;
}
.inline label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.grow {
  flex: 1;
  min-width: 180px;
}
.number {
  width: 96px;
}
.small {
  font-size: 13px;
  line-height: 18px;
}
.block {
  display: block;
}
.choices {
  margin: 0;
}
.choices legend {
  font-weight: 700;
  padding: 0 4px;
}
.choice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.scoring {
  align-self: flex-start;
  border-collapse: collapse;
}
.scoring th,
.scoring td {
  padding: 4px 12px 4px 0;
  text-align: left;
}
.presets {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.preset {
  gap: 8px;
}
.preset p {
  flex: 1;
}
.preset .button {
  margin-top: 4px;
  white-space: nowrap;
}
.file-button {
  align-self: flex-start;
  cursor: pointer;
}
.file-button:has(:focus-visible) {
  outline: 2px solid var(--link);
  outline-offset: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.editor {
  width: 100%;
  min-height: 360px;
  font:
    13px/1.5 ui-monospace,
    Menlo,
    monospace;
}
.errors {
  margin: 0;
  padding-left: 18px;
  color: var(--danger);
  font-size: 13px;
}
.status {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  font-weight: 600;
}
.import-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}
@media (max-width: 760px) {
  .options {
    grid-template-columns: 1fr;
    padding: 16px 12px;
    gap: 12px;
  }
  .options-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }
  .brand {
    width: 100%;
    margin-bottom: 4px;
  }
  .nav-feature {
    display: none;
  }
  .options-main {
    padding: 16px;
  }
  .feature-list {
    margin: 0 -16px;
  }
  .feature-row {
    padding: 14px 16px;
  }
}
</style>
