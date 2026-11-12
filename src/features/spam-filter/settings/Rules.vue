<script setup vapor lang="ts">
import { computed } from 'vue'
import type { Outcome, Rule } from '../../../model'
import { isBuiltIn } from '../../../rules/edit'
import RuleCard from '../../../ui/components/RuleCard.vue'
import { t } from '../../../ui/i18n'
import type { SectionProps } from '../../../ui/props'
import { defaultRow, fromForm } from '../../../ui/ruleForm'

const props = defineProps<SectionProps>()

const custom = computed(() => props.settings.ruleFile.rules.filter((rule) => !isBuiltIn(rule.id)))

const setRules = (change: (rules: Rule[]) => Rule[]) =>
  void props.update((current) => ({ ...current, ruleFile: { ...current.ruleFile, rules: change(current.ruleFile.rules) } }))

function add(): void {
  const taken = new Set(props.settings.ruleFile.rules.map((rule) => rule.id))
  let index = 1
  while (taken.has(`my-rule-${index}`)) index++
  const when = fromForm({ match: 'all', rows: [{ ...defaultRow('text'), value: 'example' }] })!
  setRules((rules) => [...rules, { id: `my-rule-${index}`, name: '', enabled: false, target: 'all', effect: 'tag', score: 1, when }])
}

const save = (rule: Rule) => setRules((rules) => rules.map((item) => (item.id === rule.id ? rule : item)))
const remove = (id: string) => setRules((rules) => rules.filter((rule) => rule.id !== id))

const setThreshold = (kind: 'posts' | 'replies', key: keyof Outcome, raw: string) => {
  const value = raw === '' ? null : Number(raw)
  if (value !== null && (!Number.isFinite(value) || value < 1)) return
  void props.update((current) => ({
    ...current,
    ruleFile: { ...current.ruleFile, scoring: { ...current.ruleFile.scoring, [kind]: { ...current.ruleFile.scoring[kind], [key]: value } } },
  }))
}
</script>

<template>
  <section class="section">
    <h2>{{ t('section_rules') }}</h2>
    <p class="muted">{{ t('rules_intro') }}</p>
    <div class="card">
      <h3>{{ t('scoring_title') }}</h3>
      <p class="muted small">{{ t('scoring_intro') }}</p>
      <table class="scoring">
        <thead>
          <tr>
            <th />
            <th scope="col">{{ t('scoring_tag_at') }}</th>
            <th scope="col">{{ t('scoring_hide_at') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="kind in (['posts', 'replies'] as const)" :key="kind">
            <th scope="row">{{ t(`target_${kind}`) }}</th>
            <td v-for="key in (['tagAt', 'hideAt'] as const)" :key="key">
              <input
                class="field number"
                type="number"
                min="1"
                :placeholder="t('scoring_off')"
                :value="settings.ruleFile.scoring[kind][key] ?? ''"
                :aria-label="`${t(`target_${kind}`)} ${t(key === 'tagAt' ? 'scoring_tag_at' : 'scoring_hide_at')}`"
                @change="(event: Event) => setThreshold(kind, key, (event.target as HTMLInputElement).value)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <RuleCard v-for="rule in custom" :key="rule.id + JSON.stringify(rule)" :rule="rule" @save="save" @remove="remove(rule.id)" />
    <p v-if="custom.length === 0" class="muted">{{ t('rules_empty') }}</p>
    <button type="button" class="button primary" @click="add">{{ t('rule_add') }}</button>
  </section>
</template>
