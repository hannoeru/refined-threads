import type { Component } from 'vue'

const pages = import.meta.glob<{ default: Component }>('./*/Settings.vue', { eager: true })

export const settingsPage = (id: string): Component | undefined => pages[`./${id}/Settings.vue`]?.default
