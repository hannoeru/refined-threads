import type { StoredFeatures } from '../features/state'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { FEATURES } from '../features/registry'
import { featuresItem, resolveState, setFeatureEnabled, setFeatureOption } from '../features/state'

export function useFeatures() {
  const stored = shallowRef<StoredFeatures | null>(null)
  void featuresItem.getValue().then((value) => {
    stored.value ??= value
  })
  onScopeDispose(featuresItem.watch(value => (stored.value = value ?? {})))

  const states = computed(() =>
    stored.value === null
      ? null
      : Object.fromEntries(FEATURES.map(feature => [
          feature.id,
          resolveState(feature, stored.value),
        ])),
  )

  return { states, setEnabled: setFeatureEnabled, setOption: setFeatureOption }
}
