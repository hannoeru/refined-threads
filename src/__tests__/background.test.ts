import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import background from '../../entrypoints/background'
import { readList } from '../rules/edit'
import { loadSettings } from '../settings'

describe('background', () => {
  let clicked: ((info: { menuItemId: string, linkUrl?: string }) => Promise<void>) | null = null

  beforeEach(() => {
    fakeBrowser.reset()
    vi.stubGlobal('browser', fakeBrowser)
    fakeBrowser.i18n.getMessage = ((key: string) => key) as never
    fakeBrowser.contextMenus = {
      removeAll: async () => undefined,
      create: () => 0,
      onClicked: {
        addListener: (listener: typeof clicked) => void (clicked = listener),
      },
    } as never
    background.main()
  })

  it('opens the welcome page after install, but not after an update', async () => {
    const welcome = fakeBrowser.runtime.getURL('/welcome.html')
    const welcomeTabs = async () => (await fakeBrowser.tabs.query({})).filter(tab => tab.url === welcome)
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '0.0.1' })
    expect(await welcomeTabs()).toHaveLength(0)
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' })
    expect(await welcomeTabs()).toHaveLength(1)
  })

  it('hides an account from the link context menu', async () => {
    await clicked?.({ menuItemId: 'hide-account', linkUrl: 'https://www.threads.com/@Spam.Bot/post/ABC' })
    expect(readList((await loadSettings()).ruleFile, 'hidden-accounts')).toEqual(['spam.bot'])
  })
})
