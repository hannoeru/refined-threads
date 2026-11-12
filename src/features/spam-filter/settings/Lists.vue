<script setup vapor lang="ts">
import { type ListRuleId, readList, writeList } from '../../../rules/edit'
import { normalizeHost } from '../../../rules/hosts'
import { parseHandle } from '../../../threads/handle'
import ChipInput from '../../../ui/components/ChipInput.vue'
import { t } from '../../../ui/i18n'
import type { SectionProps } from '../../../ui/props'

const props = defineProps<SectionProps>()

const set = (id: ListRuleId, values: string[]) =>
  void props.update((current) => ({ ...current, ruleFile: writeList(current.ruleFile, id, values) }))
const word = (input: string) => input.trim().toLowerCase() || null
const host = (input: string) => {
  const value = normalizeHost(input)
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value) ? value : null
}
const at = (handle: string) => `@${handle}`
</script>

<template>
  <section class="section">
    <h2>{{ t('section_lists') }}</h2>
    <p class="muted">{{ t('lists_intro') }}</p>
    <ChipInput :model-value="readList(settings.ruleFile, 'blocked-words')" :label="t('list_words')" :placeholder="t('list_words_placeholder')" :normalize="word" @update:model-value="(v: string[]) => set('blocked-words', v)" />
    <ChipInput :model-value="readList(settings.ruleFile, 'blocked-sites')" :label="t('list_sites')" placeholder="example.com" :normalize="host" @update:model-value="(v: string[]) => set('blocked-sites', v)" />
    <ChipInput :model-value="readList(settings.ruleFile, 'hidden-accounts')" :label="t('list_hidden_accounts')" placeholder="@username" :normalize="parseHandle" :display="at" @update:model-value="(v: string[]) => set('hidden-accounts', v)" />
    <ChipInput :model-value="readList(settings.ruleFile, 'allowed-accounts')" :label="t('list_allowed_accounts')" placeholder="@username" :normalize="parseHandle" :display="at" @update:model-value="(v: string[]) => set('allowed-accounts', v)" />
  </section>
</template>
