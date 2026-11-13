export type WhenVisible = (element: Element, callback: () => void) => void

export const alwaysVisible: WhenVisible = (_element, callback) => callback()

interface ObserverHost {
  IntersectionObserver?: new (
    callback: (entries: Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>[]) => void,
    options?: IntersectionObserverInit,
  ) => Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>
}

export function createWhenVisible(win: ObserverHost, signal: AbortSignal, rootMargin = '200px 0px'): WhenVisible {
  const Observer = win.IntersectionObserver
  if (!Observer)
    return alwaysVisible
  const seen = new WeakSet<Element>()
  const pending = new Map<Element, () => void>()
  const observer = new Observer(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting)
          continue
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
    if (seen.has(element))
      return callback()
    if (!pending.has(element))
      observer.observe(element)
    pending.set(element, callback)
  }
}
