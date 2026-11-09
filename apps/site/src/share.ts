import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string"

/** Longest URL we hand out before warning; browsers and chat apps start truncating around here. */
export const SHARE_LINK_SOFT_LIMIT = 32_000

export function encodeShare(messages: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(messages))
}

/** The shared history: a message array, or a conversation object. */
export function decodeShare(hash: string): object | null {
  const match = /[#&]h=([^&]+)/.exec(hash)
  if (!match) return null
  try {
    const json = decompressFromEncodedURIComponent(match[1])
    if (!json) return null
    const value: unknown = JSON.parse(json)
    return typeof value === "object" ? value : null
  } catch {
    return null
  }
}

export function shareUrl(messages: unknown): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}#h=${encodeShare(messages)}`
}
