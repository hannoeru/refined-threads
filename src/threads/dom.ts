export const POST_CONTAINER = '[data-pressable-container="true"]'

export function permalinkOf(container: Element): HTMLAnchorElement | null {
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]')) {
    if (link.querySelector('time')) return link
  }
  return null
}

export function postCodeOf(container: Element): string | null {
  return permalinkOf(container)?.getAttribute('href')?.match(/\/post\/([^/?#]+)/)?.[1] ?? null
}

export function authorLinkOf(container: Element, username: string): HTMLAnchorElement | null {
  for (const link of container.querySelectorAll<HTMLAnchorElement>(`a[href="/@${CSS.escape(username)}"]`)) {
    if (link.textContent?.trim()) return link
  }
  return null
}
