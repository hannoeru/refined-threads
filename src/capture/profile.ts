const DESCRIPTION = /<meta\s+(?:name="description"|property="og:description")\s+content="([^"]*)"/

export function findDescription(html: string): string | null | undefined {
  const match = html.match(DESCRIPTION)
  if (match) return decodeEntities(match[1] ?? '')
  return html.includes('</head>') ? null : undefined
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#039);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16))
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10))
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[lower] ?? "'"
  })
}

export async function readDescription(response: Response): Promise<string | null> {
  const reader = response.body?.getReader()
  if (!reader) return findDescription(await response.text()) ?? null
  const decoder = new TextDecoder()
  let html = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return findDescription(html) ?? null
      html += decoder.decode(value, { stream: true })
      const found = findDescription(html)
      if (found !== undefined) return found
    }
  } finally {
    void reader.cancel().catch(() => undefined)
  }
}
