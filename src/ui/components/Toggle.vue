<script setup vapor lang="ts">
const enabled = defineModel<boolean>({ required: true })
defineProps<{ label: string; description?: string }>()
</script>

<template>
  <label class="toggle">
    <span class="toggle-text">
      <span class="toggle-label">{{ label }}</span>
      <span v-if="description" class="toggle-description muted">{{ description }}</span>
    </span>
    <input v-model="enabled" type="checkbox" role="switch" class="toggle-input" />
    <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
  </label>
</template>

<style>
.toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
.toggle-text { flex: 1; display: flex; flex-direction: column; }
.toggle-label { font-weight: 600; }
.toggle-description { font-size: 13px; }
.toggle-input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.toggle-track { flex: none; width: 40px; height: 24px; border-radius: 999px; background: var(--line); position: relative; transition: background 0.15s; }
.toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); transition: transform 0.15s; }
.toggle-input:checked + .toggle-track { background: var(--roller); }
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
.toggle-input:focus-visible + .toggle-track { outline: 2px solid var(--roller); outline-offset: 2px; }
</style>
