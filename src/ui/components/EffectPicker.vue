<script setup vapor lang="ts">
import type { Effect } from '../../model'
import { computed } from 'vue'
import { t } from '../i18n'

const props = defineProps<{ allowAllow?: boolean, label?: string }>()
const effect = defineModel<Effect>('effect', { required: true })
const score = defineModel<number>('score', { required: true })
const options = computed<Effect[]>(() => (props.allowAllow
  ? ['hide', 'tag', 'score', 'allow']
  : ['hide', 'tag', 'score']))
</script>

<template>
  <div class="effect">
    <select v-model="effect" class="field" :aria-label="label ?? t('effect_label')">
      <option v-for="option in options" :key="option" :value="option">
        {{ t(`effect_${option}`) }}
      </option>
    </select>
    <input
      v-if="effect === 'score'"
      v-model.number="score"
      class="field effect-score"
      type="number"
      min="-100"
      max="100"
      step="1"
      :aria-label="t('effect_points')"
    >
  </div>
</template>

<style>
.effect {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.effect-score {
  width: 72px;
}
</style>
