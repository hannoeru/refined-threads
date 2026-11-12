import { installHook } from '../src/capture/hook'
import { THREADS_MATCHES } from '../src/bridge'

export default defineContentScript({
  matches: THREADS_MATCHES,
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installHook(window)
  },
})
