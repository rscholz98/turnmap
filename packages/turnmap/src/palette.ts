import type { AccentKey } from "./accents"

/** Accent colors by node family; any CSS color. Missing keys keep the stylesheet default. */
export type Palette = Partial<Record<AccentKey, string>>

export const PALETTE_KEYS: { key: AccentKey; label: string }[] = [
  { key: "user", label: "User prompt" },
  { key: "system", label: "System prompt" },
  { key: "response", label: "Model response" },
  { key: "thinking", label: "Thinking" },
  { key: "toolCall", label: "Tool call" },
  { key: "toolReturn", label: "Tool return" },
  { key: "builtinTool", label: "Provider tool" },
  { key: "retry", label: "Retry" },
  { key: "media", label: "Media" },
  { key: "note", label: "Note" },
  { key: "unknown", label: "Unknown" },
  { key: "flow", label: "Flow edges" },
]

/** The stylesheet defaults, as hex so color inputs can show them. */
export const DEFAULT_PALETTE: Required<Palette> = {
  user: "#3b82f6",
  system: "#6b7280",
  response: "#22a55b",
  thinking: "#d99a2b",
  toolCall: "#8b5cf6",
  toolReturn: "#737a87",
  builtinTool: "#1fa2b8",
  retry: "#dc4b3a",
  media: "#3b8fcf",
  note: "#3aa89a",
  unknown: "#8a8f9a",
  flow: "#a1a7b3",
}

export const PALETTE_PRESETS: { name: string; palette: Required<Palette> }[] = [
  { name: "Default", palette: DEFAULT_PALETTE },
  {
    name: "Pastel",
    palette: {
      user: "#7fa7ff",
      system: "#a0a6b4",
      response: "#7ccf9a",
      thinking: "#f0c674",
      toolCall: "#b89cff",
      toolReturn: "#aeb4c2",
      builtinTool: "#7fd0dd",
      retry: "#f08a8a",
      media: "#8ab8e8",
      note: "#8fd3c8",
      unknown: "#b5b9c4",
      flow: "#c6cad3",
    },
  },
  {
    name: "Vivid",
    palette: {
      user: "#0066ff",
      system: "#4b5563",
      response: "#00a84f",
      thinking: "#ff9f00",
      toolCall: "#7a1fff",
      toolReturn: "#5c6370",
      builtinTool: "#00a3c4",
      retry: "#ff2d2d",
      media: "#0088cc",
      note: "#00997a",
      unknown: "#6b7280",
      flow: "#8b919c",
    },
  },
  {
    name: "Mono",
    palette: {
      user: "#1f2937",
      system: "#6b7280",
      response: "#374151",
      thinking: "#9ca3af",
      toolCall: "#111827",
      toolReturn: "#9ca3af",
      builtinTool: "#4b5563",
      retry: "#b91c1c",
      media: "#6b7280",
      note: "#6b7280",
      unknown: "#9ca3af",
      flow: "#c4c8d0",
    },
  },
]

const CSS_VAR: Record<AccentKey, string> = {
  system: "--tm-accent-system",
  user: "--tm-accent-user",
  response: "--tm-accent-response",
  thinking: "--tm-accent-thinking",
  toolCall: "--tm-accent-tool-call",
  builtinTool: "--tm-accent-builtin",
  toolReturn: "--tm-accent-tool-return",
  retry: "--tm-accent-retry",
  media: "--tm-accent-media",
  note: "--tm-accent-note",
  unknown: "--tm-accent-unknown",
  flow: "--tm-edge-flow",
}

/** Inline style that applies a palette to the `.turnmap` root. */
export function paletteStyle(
  palette: Palette | undefined
): Record<string, string> {
  const style: Record<string, string> = {}
  if (!palette) return style
  for (const [key, value] of Object.entries(palette)) {
    if (value && key in CSS_VAR) style[CSS_VAR[key as AccentKey]] = value
  }
  return style
}
