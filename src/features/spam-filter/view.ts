import type { Display, Verdict } from '../../model'
import { THREADS_THEME } from '../../threads/dom'

export { POST_CONTAINER as CONTAINER, postCodeOf as postCode } from '../../threads/dom'

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
  slot: Element | null
}

export type ViewHandlers = {
  reveal: () => void
  conceal: () => void
  allow: () => void
}

const BAR = 'rt-bar'
const CHIP = 'rt-chip'
const STATE_CLASSES = ['rt-collapse', 'rt-blur', 'rt-revealed', 'rt-tagged']

export const STYLE = `
.rt-collapse > :not(.rt-bar) { display: none !important; }
.rt-blur > :not(.rt-bar) { filter: blur(12px); opacity: 0.6; pointer-events: none; user-select: none; }
.rt-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 10px var(--barcelona-columns-item-horizontal-padding, 16px) 2px;
  padding: 8px 12px; border-radius: 12px; border: 1px solid ${THREADS_THEME.outline}; background: ${THREADS_THEME.surface};
  font: 13px/18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: ${THREADS_THEME.secondary}; cursor: default; }
.rt-bar::before { content: ""; flex: none; width: 14px; height: 14px; background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3z'/%3E%3C/svg%3E") center / contain no-repeat; }
.rt-bar.rt-tag { padding: 4px 10px; border-style: dashed; background: transparent; }
.rt-bar.rt-tag::before { width: 8px; height: 8px; border-radius: 50%; background: ${THREADS_THEME.link}; -webkit-mask: none; mask: none; }
.rt-bar-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.rt-bar button { font: inherit; font-weight: 600; padding: 3px 12px; border-radius: 10px; border: 1px solid ${THREADS_THEME.outline};
  background: transparent; color: ${THREADS_THEME.text}; cursor: pointer; }
.rt-bar button:hover { background: ${THREADS_THEME.hover}; }
.rt-bar button:focus-visible { outline: 2px solid ${THREADS_THEME.link}; outline-offset: 2px; }
.rt-chip { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 5px; min-width: 0; max-width: 220px; padding: 0 2px 0 8px; border-radius: 999px;
  border: 1px dashed ${THREADS_THEME.outline}; font: 12px/18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-weight: 500; color: ${THREADS_THEME.secondary}; cursor: default; }
.rt-chip::before { content: ""; flex: none; width: 6px; height: 6px; border-radius: 50%; background: ${THREADS_THEME.link}; }
.rt-chip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-chip button { flex: none; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; background: transparent;
  color: inherit; font: 14px/18px system-ui, sans-serif; cursor: pointer; }
.rt-chip button:hover { background: ${THREADS_THEME.hover}; color: ${THREADS_THEME.text}; }
.rt-chip button:focus-visible { outline: 2px solid ${THREADS_THEME.link}; outline-offset: 1px; }
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
  for (const chip of container.querySelectorAll(`.${CHIP}`)) chip.remove()
  delete (container as HTMLElement).dataset.rtKey
}

const rendered = (container: Element) => container.querySelector(`:scope > .${BAR}, .${CHIP}`) !== null

const shield = (element: HTMLElement) => {
  for (const type of STOPPED) element.addEventListener(type, (event) => event.stopPropagation())
}

function renderChip(slot: Element, reasons: string, text: ViewText, handlers: ViewHandlers): void {
  const doc = slot.ownerDocument
  const chip = doc.createElement('span')
  chip.className = CHIP
  chip.setAttribute('role', 'note')
  chip.title = text.tagged(reasons)
  shield(chip)
  const label = doc.createElement('span')
  label.className = 'rt-chip-text'
  label.textContent = reasons
  const allow = button(doc, '×', handlers.allow)
  allow.title = text.notSpam
  allow.setAttribute('aria-label', `${text.notSpam}: ${reasons}`)
  chip.append(label, allow)
  slot.after(chip)
}

export function renderView(container: HTMLElement, state: ViewState, text: ViewText, handlers: ViewHandlers): void {
  const key = JSON.stringify([state.verdict.action, state.labels, state.display, state.revealed])
  if (container.dataset.rtKey === key && rendered(container)) return
  clearView(container)
  if (state.verdict.action === 'none') return
  container.dataset.rtKey = key
  const reasons = state.labels.join(', ')
  if (state.verdict.action === 'tag' && state.slot) {
    container.classList.add('rt-tagged')
    renderChip(state.slot, reasons, text, handlers)
    return
  }
  const doc = container.ownerDocument
  const bar = doc.createElement('div')
  bar.className = BAR
  bar.setAttribute('role', 'note')
  shield(bar)
  const message = doc.createElement('span')
  message.className = 'rt-bar-text'
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
