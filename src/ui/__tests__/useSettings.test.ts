// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { loadSettings } from '../../settings'
import { useSettings } from '../useSettings'

function mount() {
  const scope = effectScope()
  const state = scope.run(useSettings)!
  return {
    ...state,
    stop: () => scope.stop(),
  }
}

function setHideAt(hideAt: number) {
  return (current: NonNullable<ReturnType<typeof useSettings>['settings']['value']>) => ({
    ...current,
    ruleFile: {
      ...current.ruleFile,
      scoring: {
        ...current.ruleFile.scoring,
        posts: { ...current.ruleFile.scoring.posts, hideAt },
      },
    },
  })
}

describe('useSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.stubGlobal('browser', fakeBrowser)
  })

  it('refuses a value the settings do not allow, shows an error, and keeps saving later changes', async () => {
    const { settings, error, update, stop } = mount()
    await vi.waitFor(() => expect(settings.value).not.toBeNull())
    await update(setHideAt(150))
    expect(error.value).toBe('save_invalid')
    expect(settings.value!.ruleFile.scoring.posts.hideAt).toBe(3)
    await update(setHideAt(5))
    expect(error.value).toBeNull()
    expect((await loadSettings()).ruleFile.scoring.posts.hideAt).toBe(5)
    stop()
  })

  it('shows an error and keeps the stored value when the browser refuses the save', async () => {
    const { settings, error, update, stop } = mount()
    await vi.waitFor(() => expect(settings.value).not.toBeNull())
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'))
    await update(setHideAt(5))
    expect(error.value).toBe('save_failed')
    expect(settings.value!.ruleFile.scoring.posts.hideAt).toBe(3)
    stop()
  })

  it('applies quick changes one after the other, so none is lost', async () => {
    const { settings, update, stop } = mount()
    await vi.waitFor(() => expect(settings.value).not.toBeNull())
    await Promise.all([
      update(current => ({ ...current, tagOnly: true })),
      update(current => ({ ...current, display: 'blur' })),
    ])
    expect(await loadSettings()).toMatchObject({ tagOnly: true, display: 'blur' })
    stop()
  })
})
