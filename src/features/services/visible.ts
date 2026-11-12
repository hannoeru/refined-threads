export type WhenVisible = (element: Element, callback: () => void) => void

export const alwaysVisible: WhenVisible = (_element, callback) => callback()

export function createWhenVisible(win: Window & typeof globalThis, signal: AbortSignal, rootMargin = '200px 0px'): WhenVisible {
  if (typeof win.IntersectionObserver !== 'function') return alwaysVisible
  const seen = new WeakSet<Element>()
  const pending = new Map<Element, () => void>()
  const observer = new win.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        seen.add(entry.target)
        observer.unobserve(entry.target)
        const callback = pending.get(entry.target)
        pending.delete(entry.target)
        callback?.()
      }
    },
    { rootMargin },
  )
  signal.addEventListener(
    'abort',
    () => {
      observer.disconnect()
      pending.clear()
    },
    { once: true },
  )
  return (element, callback) => {
    if (seen.has(element)) return callback()
    if (!pending.has(element)) observer.observe(element)
    pending.set(element, callback)
  }
}
