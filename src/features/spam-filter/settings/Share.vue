<script setup vapor lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { exportSettings, mergeInto, PRESET_FILES, readSharedFile, replaceWith, type SharedFile } from '../../../share'
import Toggle from '../../../ui/components/Toggle.vue'
import { t } from '../../../ui/i18n'
import type { SectionProps } from '../../../ui/props'

const props = defineProps<SectionProps>()

const status = ref('')
const exportName = ref('')
const pending = shallowRef<SharedFile | null>(null)
const errors = ref<string[]>([])
const advanced = ref(false)
const draft = ref('')

function download(): void {
  const blob = new Blob([exportSettings(props.settings, exportName.value.trim())], { type: 'application/json' })
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
  if (!file) return
  open(await file.text())
}

function open(text: string): void {
  const result = readSharedFile(text)
  pending.value = result.ok ? result.file : null
  errors.value = result.ok ? [] : result.errors.map((error) => (error === 'not-json' ? t('import_not_json') : error))
}

async function apply(mode: 'replace' | 'merge', file: SharedFile | null = pending.value): Promise<void> {
  if (!file) return
  await props.update((current) => (mode === 'replace' ? replaceWith(file) : mergeInto(current, file)))
  pending.value = null
  status.value = t(mode === 'replace' ? 'import_replaced' : 'import_merged')
}

const presetText = (key: string) => t(key)

const editorErrors = computed(() => {
  if (!advanced.value || draft.value === '') return []
  const result = readSharedFile(draft.value)
  return result.ok ? [] : result.errors.map((error) => (error === 'not-json' ? t('import_not_json') : error))
})
const showEditor = (value: boolean) => {
  advanced.value = value
  if (value) draft.value = exportSettings(props.settings)
}
async function saveEditor(): Promise<void> {
  const result = readSharedFile(draft.value)
  if (!result.ok) return
  await apply('replace', result.file)
  draft.value = exportSettings(props.settings)
}
</script>

<template>
  <section class="section">
    <h2>{{ t('section_share') }}</h2>
    <p v-if="status" class="status" role="status">{{ status }}</p>

    <h3>{{ t('presets_title') }}</h3>
    <p class="muted">{{ t('presets_intro') }}</p>
    <ul class="presets">
      <li v-for="preset in PRESET_FILES" :key="preset.id" class="card preset">
        <strong>{{ presetText(preset.name) }}</strong>
        <p class="muted small">{{ presetText(preset.description) }}</p>
        <button type="button" class="button" @click="apply('merge', preset)">{{ t('preset_apply') }}</button>
      </li>
    </ul>

    <div class="card">
      <h3>{{ t('export_title') }}</h3>
      <p class="muted small">{{ t('export_intro') }}</p>
      <div class="inline">
        <input v-model="exportName" class="field grow" :placeholder="t('export_name_placeholder')" :aria-label="t('export_name')" />
        <button type="button" class="button primary" @click="download">{{ t('export_button') }}</button>
      </div>
    </div>

    <div class="card">
      <h3>{{ t('import_title') }}</h3>
      <p class="muted small">{{ t('import_intro') }}</p>
      <input type="file" accept="application/json,.json" :aria-label="t('import_title')" @change="load" />
      <div v-if="pending" class="import-preview">
        <p><strong>{{ pending.name || t('import_unnamed') }}</strong></p>
        <p v-if="pending.description" class="muted small">{{ pending.description }}</p>
        <p class="small">{{ t('import_rule_count', [String(pending.settings.ruleFile?.rules.length ?? 0)]) }}</p>
        <div class="inline">
          <button type="button" class="button primary" @click="apply('merge')">{{ t('import_merge') }}</button>
          <button type="button" class="button" @click="apply('replace')">{{ t('import_replace') }}</button>
          <button type="button" class="button" @click="pending = null">{{ t('cancel') }}</button>
        </div>
      </div>
      <ul v-if="errors.length" class="errors" role="alert">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
    </div>

    <div class="card">
      <Toggle :model-value="advanced" :label="t('advanced_title')" :description="t('advanced_intro')" @update:model-value="showEditor" />
      <template v-if="advanced">
        <textarea v-model="draft" class="field editor" spellcheck="false" :aria-label="t('advanced_title')" />
        <ul v-if="editorErrors.length" class="errors" role="alert">
          <li v-for="error in editorErrors" :key="error">{{ error }}</li>
        </ul>
        <div class="inline end">
          <button type="button" class="button primary" :disabled="editorErrors.length > 0" @click="saveEditor">{{ t('advanced_save') }}</button>
        </div>
      </template>
    </div>
  </section>
</template>
