<script setup vapor lang="ts">
import { computed } from 'vue'
import { t, uiLanguage } from '../../ui/i18n'
import { useFeatures } from '../../ui/useFeatures'
import { type DateStyle, formatDate } from './format'

const { states } = useFeatures()
const sample = new Date()
sample.setHours(sample.getHours() - 5, 30)

const preview = computed(() => {
  const options = states.value?.['absolute-timestamps']?.options
  if (!options) return ''
  const formatted = formatDate(sample, { style: options.style as DateStyle, time: Boolean(options.time), pattern: String(options.pattern) }, uiLanguage())
  return options.relative ? `5h · ${formatted}` : formatted
})
</script>

<template>
  <div class="card date-preview" aria-live="polite">
    <span class="muted small">{{ t('feature_absolute_timestamps_preview') }}</span>
    <span class="date-preview-value">{{ preview }}</span>
  </div>
  <div class="card small muted date-help">
    <p>{{ t('feature_absolute_timestamps_pattern_help') }}</p>
    <p><code>YYYY-MM-DD HH:mm</code> → 2026-11-13 09:45</p>
    <p><code>ddd, MMM D · h:mm A</code> → Fri, Nov 13 · 9:45 AM</p>
    <p><code>[Posted] D MMMM</code> → Posted 13 November</p>
  </div>
</template>

<style>
.date-preview { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 12px; }
.date-preview-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.date-help { gap: 4px; }
.date-help code { font: 12px ui-monospace, Menlo, monospace; padding: 1px 5px; border-radius: 6px; background: var(--accent-soft); color: var(--ink); }
</style>
