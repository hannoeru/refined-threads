import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-vue'],
  manifestVersion: 3,
  vue: { vite: { features: { vapor: true, optionsAPI: false } } },
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'contextMenus'],
    host_permissions: ['https://www.threads.com/*', 'https://threads.com/*', 'https://www.threads.net/*', 'https://threads.net/*'],
    browser_specific_settings: {
      gecko: {
        id: 'lint-roller@hanlee.co',
        strict_min_version: '128.0',
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
})
