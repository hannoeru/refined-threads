<script setup vapor lang="ts">
import type { SharedFile } from '../../../share'
import type { SectionProps } from '../../../ui/props'
import { ref } from 'vue'
import { mergeInto, PRESET_FILES } from '../../../share'
import { t } from '../../../ui/i18n'

const props = defineProps<SectionProps>()

const status = ref('')

async function apply(preset: SharedFile): Promise<void> {
  await props.update(current => mergeInto(current, preset))
  status.value = t('preset_added')
}
</script>

<template>
  <section class="section">
    <h2>{{ t('section_presets') }}</h2>
    <p class="muted">
      {{ t('presets_intro') }}
    </p>
    <p v-if="status" class="status" role="status">
      {{ status }}
    </p>
    <ul class="presets">
      <li v-for="preset in PRESET_FILES" :key="preset.id" class="card preset">
        <strong>{{ t(preset.name) }}</strong>
        <p class="muted small">
          {{ t(preset.description) }}
        </p>
        <button type="button" class="button" @click="apply(preset)">
          {{ t('preset_apply') }}
        </button>
      </li>
    </ul>
  </section>
</template>
