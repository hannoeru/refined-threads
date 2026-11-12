<script setup vapor lang="ts">
import { LEVELS, type Level } from '../../model'
import { t } from '../i18n'

const level = defineModel<Level>({ required: true })
defineProps<{ compact?: boolean }>()
</script>

<template>
  <div class="levels" :class="{ compact }" role="radiogroup" :aria-label="t('level_label')">
    <label v-for="option in LEVELS" :key="option" class="level" :class="{ selected: level === option }">
      <input v-model="level" type="radio" name="level" :value="option" class="level-input" />
      <span class="level-name">{{ t(`level_${option}`) }}</span>
      <span class="level-description muted">{{ t(`level_${option}_description`) }}</span>
    </label>
  </div>
</template>

<style>
.levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.level { display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); cursor: pointer; }
.level:hover { background: var(--accent-soft); }
.level.selected { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
.level-input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.level:has(.level-input:focus-visible) { outline: 2px solid var(--link); outline-offset: 2px; }
.level-name { font-weight: 700; }
.level-description { font-size: 13px; }
.levels.compact .level { padding: 7px 10px; border-radius: var(--radius-sm); align-items: center; }
.levels.compact .level-description { display: none; }
@media (max-width: 560px) { .levels:not(.compact) { grid-template-columns: 1fr; } }
</style>
