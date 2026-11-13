<script setup vapor lang="ts">
import type { Effect, LeafCondition, Rule } from '../../../model'
import type { SectionProps } from '../../../ui/props'
import { computed } from 'vue'
import { CountryNames } from '../../../profile/normalize'
import { findRule, readList, updateRule, writeList } from '../../../rules/edit'
import ChipInput from '../../../ui/components/ChipInput.vue'
import EffectPicker from '../../../ui/components/EffectPicker.vue'
import Toggle from '../../../ui/components/Toggle.vue'
import { t, uiLanguage } from '../../../ui/i18n'

const props = defineProps<SectionProps>()

const language = uiLanguage()
const names = new CountryNames([language])
const regionNames = new Intl.DisplayNames([language], { type: 'region' })
const flag = (code: string) => String.fromCodePoint(...[...code].map(letter => 0x1f1a5 + letter.charCodeAt(0)))
const showCountry = (code: string) => `${flag(code)} ${regionNames.of(code) ?? code}`
const suggestions = computed(() =>
  [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].flatMap(a => [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(b => a + b)).map(code => ({
    code,
    name: regionNames.of(code),
  })).filter((entry): entry is { code: string, name: string } => !!entry.name && entry.name !== entry.code).map(({ code, name }) => ({ value: code, label: name })),
)
function country(input: string) {
  const trimmed = input.trim()
  if (/^[a-z]{2}$/i.test(trimmed) && regionNames.of(trimmed.toUpperCase()) !== trimmed.toUpperCase())
    return trimmed.toUpperCase()
  return names.code(trimmed)
}

const THRESHOLD_RULES = ['new-accounts', 'few-followers', 'few-posts'] as const
const thresholdRules = computed(() =>
  THRESHOLD_RULES.map(id => findRule(props.settings.ruleFile, id)).filter((rule): rule is Rule => rule !== undefined),
)
function limitOf(rule: Rule) {
  const leaf = rule.when as LeafCondition
  return 'lt' in leaf
    ? leaf.lt
    : 0
}
const countriesRule = computed(() => findRule(props.settings.ruleFile, 'countries'))

function patch(id: string, change: Partial<Rule>) {
  return void props.update(current => ({
    ...current,
    ruleFile: updateRule(current.ruleFile, id, change),
  }))
}
function setLimit(rule: Rule, value: number) {
  if (!Number.isFinite(value) || value < 0)
    return
  patch(rule.id, {
    when: { ...(rule.when as LeafCondition), lt: value } as LeafCondition,
  })
}
function setCountries(values: string[]) {
  return void props.update(current => ({
    ...current,
    ruleFile: writeList(current.ruleFile, 'countries', values),
  }))
}
</script>

<template>
  <section class="section">
    <h2>{{ t('section_profile') }}</h2>
    <p class="muted">
      {{ t('profile_intro') }}
    </p>
    <div class="card">
      <ChipInput
        :model-value="readList(settings.ruleFile, 'countries')"
        :label="t('list_countries')"
        :placeholder="t('list_countries_placeholder')"
        :normalize="country"
        :display="showCountry"
        :suggestions="suggestions"
        @update:model-value="setCountries"
      />
      <div v-if="countriesRule" class="inline">
        <span>{{ t('countries_effect') }}</span>
        <EffectPicker
          :effect="countriesRule.effect"
          :score="countriesRule.score"
          @update:effect="(value: Effect) => patch('countries', { effect: value })"
          @update:score="(value: number) => patch('countries', { score: value })"
        />
      </div>
    </div>
    <div v-for="rule in thresholdRules" :key="rule.id" class="card">
      <Toggle
        :model-value="rule.enabled"
        :label="t(`rule_${rule.id.replaceAll('-', '_')}`)"
        :description="t(`rule_${rule.id.replaceAll('-', '_')}_description`)"
        @update:model-value="(value: boolean) => patch(rule.id, { enabled: value })"
      />
      <div v-if="rule.enabled" class="inline">
        <label>
          {{ t(`threshold_${rule.id.replaceAll('-', '_')}`) }}
          <input class="field number" type="number" min="0" :value="limitOf(rule)" @change="(event: Event) => setLimit(rule, Number((event.target as HTMLInputElement).value))">
        </label>
        <EffectPicker
          :effect="rule.effect"
          :score="rule.score"
          @update:effect="(value: Effect) => patch(rule.id, { effect: value })"
          @update:score="(value: number) => patch(rule.id, { score: value })"
        />
      </div>
    </div>
    <p class="muted small">
      {{ t('profile_cost') }}
    </p>
  </section>
</template>
