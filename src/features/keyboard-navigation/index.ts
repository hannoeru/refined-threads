import { permalinkOf, POST_CONTAINER, THREADS_THEME } from '../../threads/dom'
import { defineFeature } from '../api'

const CURRENT = 'rt-keyboard-current'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

export default defineFeature({
  id: 'keyboard-navigation',
  enabledByDefault: false,
  shortcuts: { j: 'next', k: 'previous', o: 'open' },
  init(ctx) {
    ctx.addStyle(`.${CURRENT} { box-shadow: inset 3px 0 0 ${THREADS_THEME.link}; background: ${THREADS_THEME.hover}; scroll-margin: 80px; }`)
    let current: HTMLElement | null = null

    const posts = () =>
      [...ctx.document.querySelectorAll<HTMLElement>(POST_CONTAINER)].filter((element) => permalinkOf(element) && element.getClientRects().length > 0)

    const select = (element: HTMLElement | undefined) => {
      if (!element) return
      current?.classList.remove(CURRENT)
      current = element
      element.classList.add(CURRENT)
      element.scrollIntoView({ block: 'center' })
    }

    const move = (step: 1 | -1) => {
      const list = posts()
      if (list.length === 0) return
      const index = current && list.includes(current) ? list.indexOf(current) : -1
      if (index === -1) {
        const firstVisible = list.find((element) => element.getBoundingClientRect().bottom > 0) ?? list[0]
        select(step === 1 ? firstVisible : list[Math.max(0, list.indexOf(firstVisible ?? list[0]!) - 1)])
        return
      }
      select(list[Math.min(list.length - 1, Math.max(0, index + step))])
    }

    ctx.document.defaultView?.addEventListener(
      'keydown',
      (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
        if (event.key === 'j') move(1)
        else if (event.key === 'k') move(-1)
        else if (event.key === 'o' && current) permalinkOf(current)?.click()
        else return
        event.preventDefault()
      },
      { capture: true, signal: ctx.signal },
    )
    ctx.signal.addEventListener('abort', () => current?.classList.remove(CURRENT), { once: true })
  },
})
