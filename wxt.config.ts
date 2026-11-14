import { defineConfig } from 'wxt'
import { THREADS_MATCHES } from './src/bridge'

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-vue'],
  manifestVersion: 3,
  zip: {
    excludeSources: ['store/**', '.agents/**'],
  },
  vue: {
    vite: {
      features: { vapor: true, optionsAPI: false },
    },
  },
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'contextMenus'],
    host_permissions: THREADS_MATCHES,
    browser_specific_settings: {
      gecko: {
        id: 'refined-threads@hanlee.co',
        strict_min_version: '128.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
})
