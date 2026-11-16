interface Item<T> {
  getValue: () => Promise<T>
  setValue: (value: T) => Promise<void>
}

export function createRecorder<T>(item: Item<T>, delay = 1000): (update: (value: T) => T) => void {
  let pending: ((value: T) => T)[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  return (update) => {
    pending.push(update)
    timer ??= setTimeout(async () => {
      timer = null
      const updates = pending
      pending = []
      await item.setValue(updates.reduce<T>((value, apply) => apply(value), await item.getValue()))
    }, delay)
  }
}
