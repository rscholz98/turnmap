export const PREVIEW_CHARS = 700

/** Shorten long text for the in-node preview; the dialog shows everything. */
export function preview(text: string, limit = PREVIEW_CHARS): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trimEnd()} …`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export type JsonTokenKind =
  "key" | "string" | "number" | "literal" | "punct" | "text"

export interface JsonToken {
  kind: JsonTokenKind
  text: string
}

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

/**
 * Tokenize pretty-printed JSON for syntax coloring. Anything that does not
 * parse as JSON falls back to a single text token.
 */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let last = 0
  for (const m of text.matchAll(JSON_TOKEN)) {
    const index = m.index ?? 0
    if (index > last)
      tokens.push({ kind: "text", text: text.slice(last, index) })
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        tokens.push({ kind: "key", text: m[1] })
        tokens.push({ kind: "punct", text: m[2] })
      } else {
        tokens.push({ kind: "string", text: m[1] })
      }
    } else if (m[3] !== undefined) {
      tokens.push({ kind: "number", text: m[3] })
    } else if (m[4] !== undefined) {
      tokens.push({ kind: "literal", text: m[4] })
    } else if (m[5] !== undefined) {
      tokens.push({ kind: "punct", text: m[5] })
    }
    last = index + m[0].length
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) })
  return tokens
}

export function looksLikeJson(text: string): boolean {
  const t = text.trimStart()
  return t.startsWith("{") || t.startsWith("[")
}
