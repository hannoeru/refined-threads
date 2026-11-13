// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    vue: true,
    pnpm: true,
    antislop: true,
    formatters: true,
    ignores: [
      '.output',
      '.wxt',
      '.agent',
      'assets',
      'public/_locales',
    ],
  },
)
