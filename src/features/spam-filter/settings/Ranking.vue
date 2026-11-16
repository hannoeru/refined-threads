<script setup vapor lang="ts">
import type { Ranking } from '../../../model'
import type { SectionProps } from '../../../ui/props'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { addAccount, readList, ruleLabel } from '../../../rules/edit'
import { rankingItem } from '../../../settings'
import { t } from '../../../ui/i18n'
import { topAccounts } from '../ranking'

const props = defineProps<SectionProps>()

const ranking = shallowRef<Ranking>({})
void rankingItem.getValue().then(value => (ranking.value = value))
onScopeDispose(rankingItem.watch(value => (ranking.value = value)))

const hidden = computed(() => new Set(readList(props.settings.ruleFile, 'hidden-accounts')))
const rows = computed(() => topAccounts(ranking.value).map(row => ({
  ...row,
  reason: row.topRule
    ? ruleLabel({ id: row.topRule, name: props.settings.ruleFile.rules.find(rule => rule.id === row.topRule)?.name ?? '' }, t)
    : '',
  isHidden: hidden.value.has(row.username.toLowerCase()),
})))

function hide(username: string) {
  return void props.update(current => ({
    ...current,
    ruleFile: addAccount(current.ruleFile, 'hidden-accounts', username),
  }))
}
function clear() {
  // eslint-disable-next-line no-alert -- clearing deletes the ranking for good, so ask with the native dialog
  if (confirm(t('ranking_clear_confirm')))
    void rankingItem.removeValue()
}
</script>

<template>
  <section class="section">
    <h2>{{ t('section_ranking') }}</h2>
    <p class="muted">
      {{ t('ranking_intro') }}
    </p>
    <p v-if="rows.length === 0" class="muted">
      {{ t('ranking_empty') }}
    </p>
    <div v-else class="card ranking-card">
      <table class="ranking">
        <thead>
          <tr>
            <th scope="col">
              #
            </th>
            <th scope="col">
              {{ t('ranking_account') }}
            </th>
            <th scope="col" class="count">
              {{ t('ranking_hidden') }}
            </th>
            <th scope="col" class="count">
              {{ t('ranking_tagged') }}
            </th>
            <th scope="col">
              {{ t('ranking_reason') }}
            </th>
            <th scope="col">
              {{ t('ranking_last_seen') }}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.pk">
            <td class="muted">
              {{ index + 1 }}
            </td>
            <th scope="row">
              <a :href="`https://www.threads.com/@${row.username}`" target="_blank" rel="noopener">@{{ row.username }}</a>
            </th>
            <td class="count">
              {{ row.hidden }}
            </td>
            <td class="count">
              {{ row.tagged }}
            </td>
            <td>{{ row.reason }}</td>
            <td class="muted">
              {{ row.lastSeen }}
            </td>
            <td class="action">
              <button v-if="row.isHidden" type="button" class="button" disabled>
                {{ t('ranking_is_hidden') }}
              </button>
              <button v-else type="button" class="button" @click="hide(row.username)">
                {{ t('ranking_hide') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button v-if="rows.length > 0" type="button" class="button ranking-clear" @click="clear">
      {{ t('ranking_clear') }}
    </button>
  </section>
</template>

<style>
.ranking-card {
  padding: 8px 16px;
  overflow-x: auto;
}
.ranking {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.ranking th,
.ranking td {
  padding: 8px 12px 8px 0;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--hairline);
}
.ranking tbody tr:last-child > * {
  border-bottom: 0;
}
.ranking thead th {
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}
.ranking tbody th {
  font-weight: 600;
}
.ranking a {
  color: var(--ink);
  text-decoration: none;
}
.ranking a:hover {
  text-decoration: underline;
}
.ranking .count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ranking .action {
  padding-right: 0;
  text-align: right;
}
.ranking .button {
  min-height: 30px;
  padding: 0 12px;
  font-size: 13px;
}
.ranking-clear {
  align-self: flex-start;
}
</style>
