<script setup vapor lang="ts">
import { ref } from 'vue'
import { t } from '../../src/ui/i18n'
import { useSettings } from '../../src/ui/useSettings'
import Lists from './sections/Lists.vue'
import Look from './sections/Look.vue'
import Profile from './sections/Profile.vue'
import Protection from './sections/Protection.vue'
import Rules from './sections/Rules.vue'
import Share from './sections/Share.vue'

const SECTIONS = ['protection', 'lists', 'profile', 'rules', 'look', 'share'] as const
type Section = (typeof SECTIONS)[number]

const initial = location.hash.slice(1) as Section
const current = ref<Section>(SECTIONS.includes(initial) ? initial : 'protection')
const go = (section: Section) => {
  current.value = section
  history.replaceState(null, '', `#${section}`)
}

const { settings, update } = useSettings()
</script>

<template>
  <div class="options">
    <nav class="options-nav" :aria-label="t('settings_title')">
      <div class="brand">
        <img src="/icon/48.png" alt="" width="32" height="32" />
        <span>{{ t('extName') }}</span>
      </div>
      <button
        v-for="section in SECTIONS"
        :key="section"
        type="button"
        class="nav-item"
        :aria-current="current === section ? 'page' : undefined"
        @click="go(section)"
      >
        {{ t(`section_${section}`) }}
      </button>
    </nav>
    <main v-if="settings" class="options-main">
      <Protection v-if="current === 'protection'" :settings="settings" :update="update" />
      <Lists v-else-if="current === 'lists'" :settings="settings" :update="update" />
      <Profile v-else-if="current === 'profile'" :settings="settings" :update="update" />
      <Rules v-else-if="current === 'rules'" :settings="settings" :update="update" />
      <Look v-else-if="current === 'look'" :settings="settings" :update="update" />
      <Share v-else :settings="settings" :update="update" />
    </main>
  </div>
</template>

<style>
.options { display: grid; grid-template-columns: 230px minmax(0, 720px); gap: 40px; padding: 32px; max-width: 1040px; margin: 0 auto; }
.options-nav { display: flex; flex-direction: column; gap: 2px; position: sticky; top: 32px; align-self: start; }
.brand { display: flex; align-items: center; gap: 10px; font-family: var(--heading); font-weight: 800; margin-bottom: 16px; }
.brand img { border-radius: 8px; }
.nav-item { text-align: left; border: 0; background: transparent; padding: 8px 12px; border-radius: var(--radius-sm); color: var(--muted); }
.nav-item:hover { background: var(--roller-soft); color: var(--ink); }
.nav-item[aria-current='page'] { background: var(--roller-soft); color: var(--ink); font-weight: 700; box-shadow: inset 3px 0 0 var(--roller); }
.section { display: flex; flex-direction: column; gap: 16px; }
.section h2 { font-size: 28px; font-weight: 800; }
.section h3 { font-size: 18px; }
.card { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--line); }
.row .toggle { flex: 1 1 320px; }
.inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.inline.end { justify-content: flex-end; }
.inline label { display: inline-flex; gap: 6px; align-items: center; }
.grow { flex: 1; min-width: 180px; }
.number { width: 88px; }
.small { font-size: 13px; }
.block { display: block; }
.choices { margin: 0; }
.choices legend { font-weight: 700; padding: 0 4px; }
.choice { display: flex; gap: 10px; align-items: flex-start; }
.scoring { border-collapse: collapse; }
.scoring th, .scoring td { padding: 4px 12px 4px 0; text-align: left; }
.presets { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.preset { justify-content: space-between; }
.editor { width: 100%; min-height: 360px; font: 13px/1.5 ui-monospace, Menlo, monospace; }
.errors { margin: 0; padding-left: 18px; color: var(--danger); font-size: 13px; }
.status { padding: 8px 12px; border-radius: var(--radius-sm); background: rgba(166, 226, 46, 0.2); }
.import-preview { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: var(--radius-sm); background: var(--roller-soft); }
@media (max-width: 760px) {
  .options { grid-template-columns: 1fr; padding: 16px; gap: 16px; }
  .options-nav { position: static; flex-direction: row; flex-wrap: wrap; }
  .brand { width: 100%; margin-bottom: 4px; }
  .nav-item[aria-current='page'] { box-shadow: inset 0 -3px 0 var(--roller); }
}
</style>
