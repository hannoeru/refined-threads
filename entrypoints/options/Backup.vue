<script setup vapor lang="ts">
import type { SharedFile } from '../../src/share'
import { computed, ref, shallowRef } from 'vue'
import { featuresItem } from '../../src/features/state'
import { exportSettings, importFeatures, mergeInto, readSharedFile, replaceWith } from '../../src/share'
import Toggle from '../../src/ui/components/Toggle.vue'
import { t } from '../../src/ui/i18n'
import { useSettings } from '../../src/ui/useSettings'

const { settings, error, update } = useSettings()

const status = ref('')
const exportName = ref('')
const pending = shallowRef<SharedFile | null>(null)
const errors = ref<string[]>([])
const advanced = ref(false)
const draft = ref('')

function messages(result: ReturnType<typeof readSharedFile>) {
  return result.ok
    ? []
    : result.errors.map(item => (item === 'not-json'
        ? t('import_not_json')
        : item))
}

async function currentFile(name = ''): Promise<string> {
  return exportSettings({ settings: settings.value!, features: await featuresItem.getValue() }, name)
}

async function download(): Promise<void> {
  const blob = new Blob([await currentFile(exportName.value.trim())], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'refined-threads-settings.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function load(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  const result = readSharedFile(await file.text())
  pending.value = result.ok ? result.file : null
  errors.value = messages(result)
}

async function apply(mode: 'replace' | 'merge', file: SharedFile | null = pending.value): Promise<void> {
  if (!file)
    return
  await update(current => (mode === 'replace'
    ? replaceWith(file)
    : mergeInto(current, file)))
  if (error.value)
    return
  await featuresItem.setValue(importFeatures(await featuresItem.getValue(), file, mode))
  pending.value = null
  status.value = t(mode === 'replace'
    ? 'import_replaced'
    : 'import_merged')
}

const editorErrors = computed(() => (advanced.value && draft.value !== ''
  ? messages(readSharedFile(draft.value))
  : []))

async function showEditor(value: boolean): Promise<void> {
  advanced.value = value
  if (value)
    draft.value = await currentFile()
}

async function saveEditor(): Promise<void> {
  const result = readSharedFile(draft.value)
  if (!result.ok)
    return
  await apply('replace', result.file)
  draft.value = await currentFile()
}
</script>

<template>
  <section v-if="settings" class="section">
    <h2>{{ t('backup_title') }}</h2>
    <p class="muted">
      {{ t('backup_intro') }}
    </p>
    <p v-if="status" class="status" role="status">
      {{ status }}
    </p>
    <p v-if="error" class="save-error" role="alert">
      {{ t(error) }}
    </p>

    <div class="card">
      <h3>{{ t('export_title') }}</h3>
      <p class="muted small">
        {{ t('export_intro') }}
      </p>
      <div class="inline">
        <input v-model="exportName" class="field grow" :placeholder="t('export_name_placeholder')" :aria-label="t('export_name')">
        <button type="button" class="button primary" @click="download">
          {{ t('export_button') }}
        </button>
      </div>
    </div>

    <div class="card">
      <h3>{{ t('import_title') }}</h3>
      <p class="muted small">
        {{ t('import_intro') }}
      </p>
      <label class="button file-button">
        <input class="visually-hidden" type="file" accept="application/json,.json" @change="load">
        {{ t('import_choose') }}
      </label>
      <div v-if="pending" class="import-preview">
        <p><strong>{{ pending.name || t('import_unnamed') }}</strong></p>
        <p v-if="pending.description" class="muted small">
          {{ pending.description }}
        </p>
        <p class="small">
          {{ t('import_rule_count', [String(pending.settings.ruleFile?.rules.length ?? 0)]) }}
        </p>
        <p v-if="pending.features" class="small">
          {{ t('import_has_features') }}
        </p>
        <div class="inline">
          <button type="button" class="button primary" @click="apply('merge')">
            {{ t('import_merge') }}
          </button>
          <button type="button" class="button" @click="apply('replace')">
            {{ t('import_replace') }}
          </button>
          <button type="button" class="button" @click="pending = null">
            {{ t('cancel') }}
          </button>
        </div>
      </div>
      <ul v-if="errors.length" class="errors" role="alert">
        <li v-for="item in errors" :key="item">
          {{ item }}
        </li>
      </ul>
    </div>

    <div class="card">
      <Toggle :model-value="advanced" :label="t('advanced_title')" :description="t('advanced_intro')" @update:model-value="showEditor" />
      <template v-if="advanced">
        <textarea v-model="draft" class="field editor" spellcheck="false" :aria-label="t('advanced_title')" />
        <ul v-if="editorErrors.length" class="errors" role="alert">
          <li v-for="item in editorErrors" :key="item">
            {{ item }}
          </li>
        </ul>
        <div class="inline end">
          <button type="button" class="button primary" :disabled="editorErrors.length > 0" @click="saveEditor">
            {{ t('advanced_save') }}
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
