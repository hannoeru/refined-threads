<script setup vapor lang="ts">
import { computed } from 'vue'
import { type Effect, type Level, LEVEL_TOGGLED } from '../../../model'
import { applyLevel, findRule, ruleLabel, updateRule } from '../../../rules/edit'
import EffectPicker from '../../../ui/components/EffectPicker.vue'
import LevelPicker from '../../../ui/components/LevelPicker.vue'
import Toggle from '../../../ui/components/Toggle.vue'
import { t } from '../../../ui/i18n'
import type { SectionProps } from '../../../ui/props'

const props = defineProps<SectionProps>()

const level = computed({
  get: () => props.settings.level,
  set: (value: Level) => void props.update((current) => ({ ...current, level: value, ruleFile: applyLevel(current.ruleFile, value) })),
})

const detectors = computed(() =>
  LEVEL_TOGGLED.map((id) => findRule(props.settings.ruleFile, id)).filter((rule) => rule !== undefined),
)

const patch = (id: string, change: { enabled?: boolean; effect?: Effect; score?: number }) =>
  void props.update((current) => ({ ...current, ruleFile: updateRule(current.ruleFile, id, change) }))
</script>

<template>
  <section class="section">
    <h2>{{ t('section_protection') }}</h2>
    <p class="muted">{{ t('protection_intro') }}</p>
    <LevelPicker v-model="level" />
    <h3>{{ t('detectors_title') }}</h3>
    <ul class="rows">
      <li v-for="rule in detectors" :key="rule.id" class="row">
        <Toggle
          :model-value="rule.enabled"
          :label="ruleLabel(rule, t)"
          :description="t(`rule_${rule.id.replaceAll('-', '_')}_description`)"
          @update:model-value="(value: boolean) => patch(rule.id, { enabled: value })"
        />
        <EffectPicker
          :effect="rule.effect"
          :score="rule.score"
          :label="t('effect_for', [ruleLabel(rule, t)])"
          @update:effect="(value: Effect) => patch(rule.id, { effect: value })"
          @update:score="(value: number) => patch(rule.id, { score: value })"
        />
      </li>
    </ul>
  </section>
</template>
