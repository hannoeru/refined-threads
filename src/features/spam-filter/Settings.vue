<script setup vapor lang="ts">
import { ref } from 'vue'
import { t } from '../../ui/i18n'
import { useSettings } from '../../ui/useSettings'
import Lists from './settings/Lists.vue'
import Look from './settings/Look.vue'
import Profile from './settings/Profile.vue'
import Protection from './settings/Protection.vue'
import Rules from './settings/Rules.vue'
import Share from './settings/Share.vue'

const TABS = [
  'protection',
  'lists',
  'profile',
  'rules',
  'look',
  'share',
] as const
const tab = ref<(typeof TABS)[number]>('protection')
const { settings, error, update } = useSettings()
</script>

<template>
  <div class="subtabs" role="tablist" :aria-label="t('feature_spam_filter_name')">
    <button
      v-for="item in TABS"
      :key="item"
      type="button"
      role="tab"
      class="subtab"
      :aria-selected="tab === item"
      @click="tab = item"
    >
      {{ t(`section_${item}`) }}
    </button>
  </div>
  <p v-if="error" class="save-error" role="alert">
    {{ t(error) }}
  </p>
  <template v-if="settings">
    <Protection v-if="tab === 'protection'" :settings="settings" :update="update" />
    <Lists v-else-if="tab === 'lists'" :settings="settings" :update="update" />
    <Profile v-else-if="tab === 'profile'" :settings="settings" :update="update" />
    <Rules v-else-if="tab === 'rules'" :settings="settings" :update="update" />
    <Look v-else-if="tab === 'look'" :settings="settings" :update="update" />
    <Share v-else :settings="settings" :update="update" />
  </template>
</template>

<style>
.subtabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--hairline);
  padding-bottom: 8px;
}
.subtab {
  flex: none;
  border: 0;
  background: transparent;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.subtab:hover {
  background: var(--accent-soft);
  color: var(--ink);
}
.save-error {
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 13px;
}
.subtab[aria-selected='true'] {
  background: var(--accent-soft);
  color: var(--ink);
  font-weight: 700;
}
</style>
