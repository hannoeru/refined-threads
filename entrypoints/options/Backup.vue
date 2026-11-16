<script setup vapor lang="ts">
import type { ImportMode, ImportResult, SharedFile, SharePart } from '../../src/share'
import { computed, ref, shallowRef } from 'vue'
import { featuresItem } from '../../src/features/state'
import { ALL_PARTS, applyShared, exportSettings, partsOf, readSharedFile, readSharedLink, sharedFile, shareLink } from '../../src/share'
import Toggle from '../../src/ui/components/Toggle.vue'
import { t } from '../../src/ui/i18n'
import { useSettings } from '../../src/ui/useSettings'
import PartPicker from './PartPicker.vue'

const { settings, error, update } = useSettings()

const status = ref('')
const exportName = ref('')
const exportParts = ref<SharePart[]>([...ALL_PARTS])
const linkLength = ref<number | null>(null)
const pending = shallowRef<SharedFile | null>(null)
const importParts = ref<SharePart[]>([])
const errors = ref<string[]>([])
const advanced = ref(false)
const draft = ref('')

const ERROR_TEXT: Record<string, string> = {
  'not-json': 'import_not_json',
  'not-link': 'import_not_link',
}

function messages(result: ImportResult): string[] {
  return result.ok
    ? []
    : result.errors.map(item => (ERROR_TEXT[item]
        ? t(ERROR_TEXT[item])
        : item))
}

function show(result: ImportResult): void {
  pending.value = result.ok ? result.file : null
  importParts.value = result.ok
    ? partsOf(result.file)
    : []
  errors.value = messages(result)
  status.value = ''
}

const pendingParts = computed(() => (pending.value
  ? partsOf(pending.value)
  : []))

async function config() {
  return { settings: settings.value!, features: await featuresItem.getValue() }
}

async function download(): Promise<void> {
  const blob = new Blob([
    exportSettings(await config(), exportParts.value, exportName.value.trim()),
  ], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'refined-threads-settings.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function copyLink(): Promise<void> {
  const link = await shareLink(sharedFile(await config(), exportParts.value, exportName.value.trim()))
  await navigator.clipboard.writeText(link)
  linkLength.value = link.length
}

async function load(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    show(readSharedFile(await file.text()))
}

const sharedPayload = new URLSearchParams(location.search).get('share')
if (sharedPayload) {
  history.replaceState(null, '', location.pathname + location.hash)
  void readSharedLink(sharedPayload).then(show)
}

async function apply(mode: ImportMode, file: SharedFile | null = pending.value, parts: readonly SharePart[] = importParts.value): Promise<void> {
  if (!file)
    return
  let features = await featuresItem.getValue()
  await update((current) => {
    const next = applyShared({ settings: current, features }, file, parts, mode)
    features = next.features
    return next.settings
  })
  if (error.value)
    return
  await featuresItem.setValue(features)
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
    draft.value = exportSettings(await config())
}

async function saveEditor(): Promise<void> {
  const result = readSharedFile(draft.value)
  if (!result.ok)
    return
  await apply('replace', result.file, ALL_PARTS)
  draft.value = exportSettings(await config())
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
      <PartPicker v-model="exportParts" :legend="t('export_parts')" :parts="ALL_PARTS" />
      <input v-model="exportName" class="field" :placeholder="t('export_name_placeholder')" :aria-label="t('export_name')">
      <div class="inline">
        <button type="button" class="button primary" :disabled="exportParts.length === 0" @click="download">
          {{ t('export_button') }}
        </button>
        <button type="button" class="button" :disabled="exportParts.length === 0" @click="copyLink">
          {{ t('export_link_button') }}
        </button>
        <span v-if="linkLength !== null" class="muted small" role="status">
          {{ t('export_link_copied', [linkLength.toLocaleString()]) }}
        </span>
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
        <PartPicker v-model="importParts" :legend="t('import_parts')" :parts="pendingParts" />
        <div class="inline">
          <button type="button" class="button primary" :disabled="importParts.length === 0" @click="apply('merge')">
            {{ t('import_merge') }}
          </button>
          <button type="button" class="button" :disabled="importParts.length === 0" @click="apply('replace')">
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
