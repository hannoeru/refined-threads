import { RE2JS } from 're2js'

export type Pattern = (text: string) => boolean

/** RE2 runs in linear time, so a pattern from a shared settings file cannot stall the page. */
export function compilePattern(source: string): Pattern | null {
  try {
    const pattern = RE2JS.compile(source, RE2JS.CASE_INSENSITIVE)
    return text => pattern.test(text)
  }
  catch {
    return null
  }
}
