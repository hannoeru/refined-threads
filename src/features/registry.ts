import type { Feature } from './api'

const modules = import.meta.glob<{ default: Feature }>('./*/index.ts', { eager: true })

export const FEATURES: readonly Feature[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.id.localeCompare(b.id))

export const featureById = (id: string): Feature | undefined => FEATURES.find((feature) => feature.id === id)
