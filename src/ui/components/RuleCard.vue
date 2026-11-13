<script setup vapor lang="ts">
import type { Effect, Field, Rule, Target } from '../../model'
import type { Operator, Row } from '../ruleForm'
import { computed, ref } from 'vue'
import { FIELDS, TARGETS } from '../../model'
import { t } from '../i18n'
import { defaultRow, FIELD_KINDS, fromForm, operatorsFor, toForm } from '../ruleForm'
import EffectPicker from './EffectPicker.vue'
import Toggle from './Toggle.vue'

const props = defineProps<{ rule: Rule }>()
const emit = defineEmits<{ save: [rule: Rule], remove: [] }>()

const initial = toForm(props.rule.when)
const name = ref(props.rule.name)
const enabled = ref(props.rule.enabled)
const target = ref<Target>(props.rule.target)
const effect = ref<Effect>(props.rule.effect)
const score = ref(props.rule.score)
const match = ref<'all' | 'any'>(initial?.match ?? 'all')
const rows = ref<Row[]>(initial?.rows ?? [
  defaultRow(),
])
const editable = initial !== null

const condition = computed(() => fromForm({ match: match.value, rows: rows.value }))
const valid = computed(() => !editable || condition.value !== null)

const fieldLabel = (field: Field) => t(`field_${field.replaceAll('.', '_')}`)
function setField(index: number, field: Field) {
  rows.value = rows.value.map((row, at) => (at === index
    ? defaultRow(field)
    : row))
}
function setRow(index: number, change: Partial<Row>) {
  rows.value = rows.value.map((row, at) => (at === index
    ? {
        ...row,
        ...change,
      }
    : row))
}
function addRow() {
  return rows.value = [
    ...rows.value,
    defaultRow(),
  ]
}
const removeRow = (index: number) => (rows.value = rows.value.filter((_, at) => at !== index))

function save(): void {
  const when = editable ? condition.value : props.rule.when
  if (!when)
    return
  emit('save', {
    ...props.rule,
    name: name.value.trim(),
    enabled: enabled.value,
    target: target.value,
    effect: effect.value,
    score: score.value,
    when,
  })
}
</script>

<template>
  <article class="card rule-card">
    <div class="rule-head">
      <input v-model="name" class="field rule-name" :placeholder="t('rule_name_placeholder')" :aria-label="t('rule_name')">
      <Toggle v-model="enabled" :label="t('rule_enabled')" />
    </div>
    <div class="inline">
      <label>{{ t('rule_applies_to') }}
        <select v-model="target" class="field">
          <option v-for="option in TARGETS" :key="option" :value="option">{{ t(`target_${option}`) }}</option>
        </select>
      </label>
      <label v-if="editable">{{ t('rule_match') }}
        <select v-model="match" class="field">
          <option value="all">{{ t('match_all') }}</option>
          <option value="any">{{ t('match_any') }}</option>
        </select>
      </label>
    </div>
    <ul v-if="editable" class="conditions">
      <li v-for="(row, index) in rows" :key="index" class="condition">
        <select class="field" :value="row.field" :aria-label="t('condition_field')" @change="(event: Event) => setField(index, (event.target as HTMLSelectElement).value as Field)">
          <option v-for="field in FIELDS" :key="field" :value="field">
            {{ fieldLabel(field) }}
          </option>
        </select>
        <select class="field" :value="row.operator" :aria-label="t('condition_operator')" @change="(event: Event) => setRow(index, { operator: (event.target as HTMLSelectElement).value as Operator })">
          <option v-for="operator in operatorsFor(row.field)" :key="operator" :value="operator">
            {{ t(`op_${operator}`) }}
          </option>
        </select>
        <select v-if="FIELD_KINDS[row.field] === 'flag'" class="field" :value="row.value" :aria-label="t('condition_value')" @change="(event: Event) => setRow(index, { value: (event.target as HTMLSelectElement).value })">
          <option value="true">
            {{ t('yes') }}
          </option>
          <option value="false">
            {{ t('no') }}
          </option>
        </select>
        <input
          v-else
          class="field condition-value"
          :type="row.operator === 'gt' || row.operator === 'lt' ? 'number' : 'text'"
          :value="row.value"
          :placeholder="t(`op_${row.operator}_placeholder`)"
          :aria-label="t('condition_value')"
          @input="(event: Event) => setRow(index, { value: (event.target as HTMLInputElement).value })"
        >
        <button v-if="rows.length > 1" type="button" class="chip-remove" :aria-label="t('condition_remove')" @click="removeRow(index)">
          ×
        </button>
      </li>
    </ul>
    <p v-else class="muted small">
      {{ t('rule_json_only') }}
    </p>
    <div class="inline">
      <button v-if="editable" type="button" class="button" @click="addRow">
        {{ t('condition_add') }}
      </button>
      <span>{{ t('rule_then') }}</span>
      <EffectPicker v-model:effect="effect" v-model:score="score" allow-allow />
    </div>
    <p v-if="!valid" class="chips-error" role="alert">
      {{ t('rule_invalid') }}
    </p>
    <div class="inline end">
      <button type="button" class="button" @click="emit('remove')">
        {{ t('rule_delete') }}
      </button>
      <button type="button" class="button primary" :disabled="!valid" @click="save">
        {{ t('rule_save') }}
      </button>
    </div>
  </article>
</template>

<style>
.rule-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rule-head {
  display: flex;
  gap: 12px;
  align-items: center;
}
.rule-name {
  flex: 1;
  font-weight: 600;
}
.conditions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.condition {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.condition-value {
  flex: 1;
  min-width: 140px;
}
</style>
