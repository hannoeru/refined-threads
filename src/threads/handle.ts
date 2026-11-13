const HANDLE = /^[a-z0-9._]{1,30}$/

export function handleFromUrl(url: string): string | null {
  let path: string
  try {
    path = new URL(url, 'https://www.threads.com').pathname
  }
  catch {
    return null
  }
  const match = path.match(/^\/@([^/]+)/)
  const handle = match?.[1]
    ? decodeURIComponent(match[1]).toLowerCase()
    : null
  return handle && HANDLE.test(handle)
    ? handle
    : null
}

export function parseHandle(input: string): string | null {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/@'))
    return handleFromUrl(trimmed)
  const handle = trimmed.replace(/^@/, '').toLowerCase()
  return HANDLE.test(handle)
    ? handle
    : null
}
