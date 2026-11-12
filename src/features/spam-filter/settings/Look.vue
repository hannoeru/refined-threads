<script setup vapor lang="ts">
import { computed } from 'vue'
import { type Display, DISPLAYS } from '../../../model'
import Toggle from '../../../ui/components/Toggle.vue'
import { t } from '../../../ui/i18n'
import type { SectionProps } from '../../../ui/props'

const props = defineProps<SectionProps>()

const display = computed({
  get: () => props.settings.display,
  set: (value: Display) => void props.update((current) => ({ ...current, display: value })),
})
const tagOnly = computed({
  get: () => props.settings.tagOnly,
  set: (value: boolean) => void props.update((current) => ({ ...current, tagOnly: value })),
})
</script>

<template>
  <section class="section">
    <h2>{{ t('section_look') }}</h2>
    <fieldset class="card choices">
      <legend>{{ t('display_title') }}</legend>
      <label v-for="option in DISPLAYS" :key="option" class="choice">
        <input v-model="display" type="radio" name="display" :value="option" />
        <span>
          <strong>{{ t(`display_${option}`) }}</strong>
          <span class="muted small block">{{ t(`display_${option}_description`) }}</span>
        </span>
      </label>
    </fieldset>
    <div class="card">
      <Toggle v-model="tagOnly" :label="t('tag_only')" :description="t('tag_only_description')" />
    </div>
  </section>
</template>
