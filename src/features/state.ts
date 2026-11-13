import type { Feature } from './api'
import { storage } from '#imports'
import { resolveOptions } from './api'

interface StoredFeature { enabled?: boolean, options?: Record<string, unknown> }

export type StoredFeatures = Record<string, StoredFeature>

export const featuresItem = storage.defineItem<StoredFeatures>('sync:features', { fallback: {} })

export interface FeatureState { enabled: boolean, options: Record<string, unknown> }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function resolveState(feature: Feature, stored: StoredFeatures | null | undefined): FeatureState {
  const entry = isRecord(stored) && isRecord(stored[feature.id])
    ? (stored[feature.id] as StoredFeature)
    : {}
  return {
    enabled: typeof entry.enabled === 'boolean'
      ? entry.enabled
      : feature.enabledByDefault,
    options: resolveOptions(feature.options, isRecord(entry.options)
      ? entry.options
      : undefined),
  }
}

export async function setFeatureEnabled(id: string, enabled: boolean): Promise<void> {
  const stored = await featuresItem.getValue()
  await featuresItem.setValue({
    ...stored,
    [id]: { ...stored[id], enabled },
  })
}

export async function setFeatureOption(id: string, key: string, value: unknown): Promise<void> {
  const stored = await featuresItem.getValue()
  const entry = stored[id] ?? {}
  await featuresItem.setValue({
    ...stored,
    [id]: {
      ...entry,
      options: { ...entry.options, [key]: value },
    },
  })
}
