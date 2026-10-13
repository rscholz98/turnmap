/**
 * One accent per node family. Node borders, edge strokes and minimap dots all
 * read from here so each concept keeps a single color across the canvas in
 * both themes. The values are CSS variables defined in styles.css under the
 * `.turnmap` root, so consumers can retheme without touching the code.
 */
export const ACCENTS = {
  system: "var(--tm-accent-system)",
  user: "var(--tm-accent-user)",
  response: "var(--tm-accent-response)",
  thinking: "var(--tm-accent-thinking)",
  toolCall: "var(--tm-accent-tool-call)",
  builtinTool: "var(--tm-accent-builtin)",
  toolReturn: "var(--tm-accent-tool-return)",
  retry: "var(--tm-accent-retry)",
  media: "var(--tm-accent-media)",
  note: "var(--tm-accent-note)",
  unknown: "var(--tm-accent-unknown)",
  flow: "var(--tm-edge-flow)",
} as const

export type AccentKey = keyof typeof ACCENTS
