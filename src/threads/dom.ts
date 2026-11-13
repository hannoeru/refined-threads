export const POST_CONTAINER = '[data-pressable-container="true"]'

export function permalinkOf(container: Element): HTMLAnchorElement | null {
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]')) {
    if (link.querySelector('time'))
      return link
  }
  return null
}

export function postCodeOf(container: Element): string | null {
  return permalinkOf(container)?.getAttribute('href')?.match(/\/post\/([^/?#]+)/)?.[1] ?? null
}

function authorLinkOf(container: Element, username: string): HTMLAnchorElement | null {
  for (const link of container.querySelectorAll<HTMLAnchorElement>(`a[href="/@${CSS.escape(username)}"]`)) {
    if (link.textContent?.trim())
      return link
  }
  return null
}

export function nameSlotOf(container: Element, username: string): Element | null {
  const link = authorLinkOf(container, username)
  if (!link)
    return null
  const permalink = permalinkOf(container)
  let slot: Element = link
  while (slot.parentElement && slot.parentElement !== container) {
    if (permalink && slot.parentElement.contains(permalink))
      return slot
    slot = slot.parentElement
  }
  return link
}

export function authorHeaderOf(container: Element, username: string): Element | null {
  const slot = nameSlotOf(container, username)
  const header = slot?.parentElement?.parentElement
  if (!slot || !header || slot.parentElement === container || header === container || !container.contains(header))
    return null
  return header.ownerDocument.defaultView?.getComputedStyle(header).display === 'grid'
    ? header
    : null
}

export const THREADS_THEME = {
  text: 'var(--barcelona-primary-text, currentColor)',
  secondary: 'var(--barcelona-secondary-icon, rgb(119, 119, 119))',
  surface: 'var(--barcelona-elevated-background, rgba(127, 127, 127, 0.08))',
  pill: 'var(--barcelona-author-pill-background, rgba(127, 127, 127, 0.12))',
  outline: 'var(--barcelona-primary-column-outline, rgba(127, 127, 127, 0.25))',
  hover: 'var(--barcelona-hovered-background, rgba(127, 127, 127, 0.06))',
  link: 'var(--barcelona-link-text, rgb(0, 149, 246))',
  error: 'var(--barcelona-error-text, rgb(255, 48, 64))',
} as const
