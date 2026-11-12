import type { Display, Verdict } from '../model'

export const CONTAINER = '[data-pressable-container="true"]'

export function postCode(container: Element): string | null {
  for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href*="/post/"]')) {
    if (!link.querySelector('time')) continue
    const match = link.getAttribute('href')?.match(/\/post\/([^/?#]+)/)
    if (match?.[1]) return match[1]
  }
  return null
}

export type ViewText = {
  hidden: (reasons: string) => string
  tagged: (reasons: string) => string
  show: string
  notSpam: string
  keepHiding: string
}

export type ViewState = {
  verdict: Verdict
  labels: string[]
  display: Display
  revealed: boolean
}

export type ViewHandlers = {
  reveal: () => void
  conceal: () => void
  allow: () => void
}

const BAR = 'rt-bar'
const STATE_CLASSES = ['rt-collapse', 'rt-blur', 'rt-revealed', 'rt-tagged']

export const STYLE = `
.rt-collapse > :not(.rt-bar) { display: none !important; }
.rt-blur > :not(.rt-bar) { filter: blur(10px); pointer-events: none; user-select: none; }
.rt-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 12px; padding: 6px 10px;
  border-radius: 10px; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: rgba(91, 30, 158, 0.08); color: #3b1468; border: 1px solid rgba(91, 30, 158, 0.25); cursor: default; }
.rt-bar.rt-tag { background: rgba(166, 226, 46, 0.14); border-color: rgba(110, 160, 20, 0.45); color: #2f4a06; }
.rt-bar-text { flex: 1 1 auto; min-width: 0; }
.rt-bar button { font: inherit; padding: 2px 10px; border-radius: 999px; border: 1px solid currentColor;
  background: transparent; color: inherit; cursor: pointer; }
.rt-bar button:focus-visible { outline: 2px solid #5b1e9e; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .rt-bar { background: rgba(167, 120, 230, 0.14); color: #e2d2fb; border-color: rgba(167, 120, 230, 0.4); }
  .rt-bar.rt-tag { background: rgba(166, 226, 46, 0.12); color: #d6f59a; border-color: rgba(166, 226, 46, 0.4); }
}
`

const STOPPED = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']

function button(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
  const element = doc.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.addEventListener('click', (event) => {
    event.preventDefault()
    onClick()
  })
  return element
}

export function clearView(container: Element): void {
  container.classList.remove(...STATE_CLASSES)
  container.querySelector(`:scope > .${BAR}`)?.remove()
  delete (container as HTMLElement).dataset.rtKey
}

export function renderView(container: HTMLElement, state: ViewState, text: ViewText, handlers: ViewHandlers): void {
  const key = JSON.stringify([state.verdict.action, state.labels, state.display, state.revealed])
  if (container.dataset.rtKey === key && container.querySelector(`:scope > .${BAR}`)) return
  clearView(container)
  if (state.verdict.action === 'none') return
  container.dataset.rtKey = key
  const doc = container.ownerDocument
  const bar = doc.createElement('div')
  bar.className = BAR
  bar.setAttribute('role', 'note')
  for (const type of STOPPED) bar.addEventListener(type, (event) => event.stopPropagation())
  const message = doc.createElement('span')
  message.className = 'rt-bar-text'
  const reasons = state.labels.join(', ')
  bar.append(message)
  if (state.verdict.action === 'tag') {
    bar.classList.add('rt-tag')
    container.classList.add('rt-tagged')
    message.textContent = text.tagged(reasons)
    bar.append(button(doc, text.notSpam, handlers.allow))
  } else if (!state.revealed) {
    container.classList.add(state.display === 'blur' ? 'rt-blur' : 'rt-collapse')
    message.textContent = text.hidden(reasons)
    bar.append(button(doc, text.show, handlers.reveal))
  } else {
    container.classList.add('rt-revealed')
    message.textContent = text.hidden(reasons)
    bar.append(button(doc, text.notSpam, handlers.allow), button(doc, text.keepHiding, handlers.conceal))
  }
  container.prepend(bar)
}
