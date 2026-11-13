export function observe<E extends Element>(root: Document, selector: string, callback: (element: E) => void, signal: AbortSignal): void {
  const seen = new WeakSet<Element>()
  const visit = (element: Element) => {
    if (seen.has(element))
      return
    seen.add(element)
    callback(element as E)
  }
  const scan = (node: ParentNode) => {
    if (node instanceof Element && node.matches(selector))
      visit(node)
    for (const element of node.querySelectorAll(selector)) visit(element)
  }
  scan(root)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element)
          scan(node)
      }
    }
  })
  observer.observe(root.documentElement, { childList: true, subtree: true })
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
}
