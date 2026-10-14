import { createContext, useContext } from "react"

export interface TurnMapSettings {
  /** Whether the dark theme is active. */
  dark: boolean
  /** Id of the node the navigation and side panel are on. */
  activeId: string | null
  /** Open the side panel on a node (a click on the node). */
  openNode: (id: string) => void
}

export const TurnMapContext = createContext<TurnMapSettings>({
  dark: false,
  activeId: null,
  openNode: () => {},
})

export function useTurnMapSettings() {
  return useContext(TurnMapContext)
}
