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
