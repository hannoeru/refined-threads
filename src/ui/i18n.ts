export function t(key: string, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key as never, substitutions) || key
}

export function uiLanguage(): string {
  return (browser.i18n.getMessage('@@ui_locale') || 'en').replace('_', '-')
}
