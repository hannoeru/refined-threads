export function linkHost(link: string): string | null {
  try {
    return new URL(link).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  }
  catch {
    return null
  }
}

export function hostMatches(host: string, target: string): boolean {
  return host === target || host.endsWith(`.${target}`)
}

export function normalizeHost(input: string): string {
  const trimmed = input.trim().toLowerCase()
  const withScheme = /^[a-z]+:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  return linkHost(withScheme) ?? trimmed
}
