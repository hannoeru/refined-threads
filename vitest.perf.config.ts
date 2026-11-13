import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  plugins: [
    WxtVitest(),
    vue({
      features: { vapor: true, optionsAPI: false },
    }),
  ],
  test: {
    include: ['src/**/*.perf.test.ts'],
  },
  resolve: {
    alias: [
      { find: /^vue$/, replacement: 'vue/dist/vue.runtime-with-vapor.esm-browser.js' },
    ],
  },
})
