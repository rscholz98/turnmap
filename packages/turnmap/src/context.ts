import { createContext, useContext } from "react"

export interface TurnMapSettings {
  /** Character count above which a tool return starts collapsed. */
  collapseThreshold: number
  /** Whether the dark theme is active (carried into dialog portals). */
  dark: boolean
  /** Whether nodes show their details section by default (else header + summary only). */
  expandNodes: boolean
}

export const TurnMapContext = createContext<TurnMapSettings>({
  collapseThreshold: 600,
  dark: false,
  expandNodes: false,
})

export function useTurnMapSettings() {
  return useContext(TurnMapContext)
}
