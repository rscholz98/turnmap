import { createContext, useContext } from "react"

import type { Direction } from "./layout"

export interface TurnMapSettings {
  direction: Direction
  /** Character count above which a tool return starts collapsed. */
  collapseThreshold: number
  /** Whether the dark theme is active (carried into dialog portals). */
  dark: boolean
}

export const TurnMapContext = createContext<TurnMapSettings>({
  direction: "TB",
  collapseThreshold: 600,
  dark: false,
})

export function useTurnMapSettings() {
  return useContext(TurnMapContext)
}
