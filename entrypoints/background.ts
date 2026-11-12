import { addAccount } from '../src/rules/edit'
import { handleFromUrl } from '../src/page/handle'
import { loadSettings, saveSettings } from '../src/settings'

const PROFILE_LINKS = ['https://www.threads.com/@*', 'https://threads.com/@*', 'https://www.threads.net/@*', 'https://threads.net/@*']

const MENUS = { 'hide-account': 'hidden-accounts', 'allow-account': 'allowed-accounts' } as const

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({ id: 'hide-account', title: browser.i18n.getMessage('menu_hide_account'), contexts: ['link'], targetUrlPatterns: PROFILE_LINKS })
      browser.contextMenus.create({ id: 'allow-account', title: browser.i18n.getMessage('menu_allow_account'), contexts: ['link'], targetUrlPatterns: PROFILE_LINKS })
    })
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') })
  })

  browser.contextMenus.onClicked.addListener(async (info) => {
    const list = MENUS[info.menuItemId as keyof typeof MENUS]
    const handle = info.linkUrl ? handleFromUrl(info.linkUrl) : null
    if (!list || !handle) return
    const settings = await loadSettings()
    await saveSettings({ ...settings, ruleFile: addAccount(settings.ruleFile, list, handle) })
  })
})
