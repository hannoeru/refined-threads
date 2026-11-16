<script setup vapor lang="ts">
import type { SharePart } from '../../src/share'
import { computed } from 'vue'
import { SHARE_PARTS } from '../../src/share'
import { t } from '../../src/ui/i18n'

const props = defineProps<{ legend: string, parts: readonly SharePart[] }>()
const chosen = defineModel<SharePart[]>({ required: true })

const shown = computed(() => SHARE_PARTS.filter(part => props.parts.includes(part.id)))
</script>

<template>
  <fieldset class="choices part-picker">
    <legend>{{ legend }}</legend>
    <label v-for="part in shown" :key="part.id" class="choice">
      <input v-model="chosen" type="checkbox" :value="part.id">
      <span>
        <strong>{{ t(part.label) }}</strong>
        <span class="muted small block">{{ t(part.description) }}</span>
      </span>
    </label>
  </fieldset>
</template>
