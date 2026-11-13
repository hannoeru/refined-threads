<script setup vapor lang="ts">
import { ref } from 'vue'
import { t } from '../i18n'

const props = defineProps<{
  label: string
  placeholder?: string
  normalize: (input: string) => string | null
  display?: (item: string) => string
  suggestions?: { value: string, label: string }[]
}>()
const items = defineModel<string[]>({ required: true })
const draft = ref('')
const error = ref(false)
const listId = `chips-${Math.random().toString(36).slice(2)}`

function commit(): void {
  const parts = draft.value.split(/[,\n、，]/).map(part => part.trim()).filter(Boolean)
  if (parts.length === 0)
    return
  const added: string[] = []
  for (const part of parts) {
    const value = props.normalize(part)
    if (value === null) {
      error.value = true
      return
    }
    added.push(value)
  }
  error.value = false
  items.value = [
    ...new Set([
      ...items.value,
      ...added,
    ]),
  ]
  draft.value = ''
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  }
}

function remove(item: string): void {
  items.value = items.value.filter(value => value !== item)
}
</script>

<template>
  <div class="chips">
    <label class="chips-label" :for="`${listId}-input`">{{ label }}</label>
    <ul v-if="items.length" class="chips-list">
      <li v-for="item in items" :key="item" class="chip">
        <span>{{ display ? display(item) : item }}</span>
        <button type="button" class="chip-remove" :aria-label="t('remove_item', [display ? display(item) : item])" @click="remove(item)">
          ×
        </button>
      </li>
    </ul>
    <div class="chips-add">
      <input
        :id="`${listId}-input`"
        v-model="draft"
        class="field"
        :placeholder="placeholder"
        :list="suggestions ? listId : undefined"
        :aria-invalid="error"
        @keydown="onKey"
        @blur="commit"
      >
      <button type="button" class="button" @click="commit">
        {{ t('add') }}
      </button>
    </div>
    <datalist v-if="suggestions" :id="listId">
      <option v-for="option in suggestions" :key="option.value" :value="option.label" />
    </datalist>
    <p v-if="error" class="chips-error" role="alert">
      {{ t('chip_invalid') }}
    </p>
  </div>
</template>

<style>
.chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chips-label {
  font-weight: 600;
}
.chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
}
.chip-remove {
  border: 0;
  background: transparent;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 16px;
  line-height: 1;
}
.chip-remove:hover {
  background: var(--line);
}
.chips-add {
  display: flex;
  gap: 8px;
}
.chips-add .field {
  flex: 1;
  min-width: 0;
}
.chips-error {
  color: var(--danger);
  font-size: 13px;
}
</style>
