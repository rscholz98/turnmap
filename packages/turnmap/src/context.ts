import { createContext, useContext } from "react"

export interface TurnMapSettings {
  /** Character count above which a tool return starts collapsed. */
  collapseThreshold: number
  /** Whether the dark theme is active. */
  dark: boolean
  /** Whether nodes show their details section by default (else header + summary only). */
  expandNodes: boolean
  /** Id of the node the navigation and side panel are on. */
  activeId: string | null
  /** Open the side panel on a node (called by the node's open button). */
  openNode: (id: string) => void
}

export const TurnMapContext = createContext<TurnMapSettings>({
  collapseThreshold: 600,
  dark: false,
  expandNodes: false,
  activeId: null,
  openNode: () => {},
})

export function useTurnMapSettings() {
  return useContext(TurnMapContext)
}
