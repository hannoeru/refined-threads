import { describe, expect, it } from 'vitest'
import { createWhenVisible } from '../services/visible'

class FakeObserver {
  static last: FakeObserver
  observed = new Set<Element>()
  disconnected = false
  constructor(readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    FakeObserver.last = this
  }
  observe(element: Element) {
    this.observed.add(element)
  }
  unobserve(element: Element) {
    this.observed.delete(element)
  }
  disconnect() {
    this.disconnected = true
  }
  show(element: Element, isIntersecting = true) {
    this.callback([{ target: element, isIntersecting }])
  }
}

const fakeWindow = { IntersectionObserver: FakeObserver } as unknown as Window & typeof globalThis

describe('createWhenVisible', () => {
  it('runs the latest callback once the element comes near the screen, and at once after that', () => {
    const controller = new AbortController()
    const whenVisible = createWhenVisible(fakeWindow, controller.signal)
    const element = {} as Element
    const calls: string[] = []
    whenVisible(element, () => calls.push('first'))
    whenVisible(element, () => calls.push('latest'))
    expect(calls).toEqual([])
    FakeObserver.last.show(element, false)
    expect(calls).toEqual([])
    FakeObserver.last.show(element)
    expect(calls).toEqual(['latest'])
    expect(FakeObserver.last.observed.has(element)).toBe(false)
    whenVisible(element, () => calls.push('again'))
    expect(calls).toEqual(['latest', 'again'])
  })

  it('stops watching when the feature turns off', () => {
    const controller = new AbortController()
    const whenVisible = createWhenVisible(fakeWindow, controller.signal)
    const calls: string[] = []
    const element = {} as Element
    whenVisible(element, () => calls.push('x'))
    controller.abort()
    FakeObserver.last.show(element)
    expect(FakeObserver.last.disconnected).toBe(true)
    expect(calls).toEqual([])
  })
})
