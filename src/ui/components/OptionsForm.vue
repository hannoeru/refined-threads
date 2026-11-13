<script setup vapor lang="ts">
import type { Feature, OptionSpec } from '../../features/api'
import { computed } from 'vue'
import { featureKey } from '../../features/api'
import { t } from '../i18n'
import Toggle from './Toggle.vue'

const props = defineProps<{ feature: Feature, values: Record<string, unknown> }>()
const emit = defineEmits<{ change: [key: string, value: unknown] }>()

const entries = computed(() => Object.entries(props.feature.options) as [string, OptionSpec][])
const label = (key: string) => t(featureKey(props.feature.id, `option_${key}`))
const choice = (key: string, value: string) => t(featureKey(props.feature.id, `option_${key}_${value.replaceAll('-', '_')}`))
</script>

<template>
  <div v-if="entries.length" class="card options-form">
    <template v-for="[key, spec] in entries" :key="key">
      <Toggle
        v-if="spec.type === 'boolean'"
        :model-value="Boolean(values[key])"
        :label="label(key)"
        @update:model-value="(value: boolean) => emit('change', key, value)"
      />
      <label v-else class="option-row">
        <span class="option-label">{{ label(key) }}</span>
        <select v-if="spec.type === 'select'" class="field" :value="values[key]" @change="(event: Event) => emit('change', key, (event.target as HTMLSelectElement).value)">
          <option v-for="value in spec.choices" :key="value" :value="value">{{ choice(key, value) }}</option>
        </select>
        <input
          v-else-if="spec.type === 'number'"
          class="field number"
          type="number"
          :min="spec.min"
          :max="spec.max"
          :value="values[key]"
          @change="(event: Event) => emit('change', key, Number((event.target as HTMLInputElement).value))"
        >
        <input v-else class="field grow" :value="values[key]" @change="(event: Event) => emit('change', key, (event.target as HTMLInputElement).value)">
      </label>
    </template>
  </div>
</template>

<style>
.options-form {
  gap: 16px;
}
.option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.option-label {
  font-weight: 600;
}
.option-row > .field:not(.number) {
  flex: 0 1 280px;
  min-width: 0;
}
</style>
