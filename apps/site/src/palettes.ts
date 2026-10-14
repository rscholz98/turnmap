import { useCallback, useState } from "react"
import { DEFAULT_PALETTE, PALETTE_PRESETS, type Palette } from "turnmap"

export interface SavedPalette {
  id: string
  name: string
  palette: Required<Palette>
}

const SAVED_KEY = "turnmap.palettes"
const ACTIVE_KEY = "turnmap.palette.active"

function loadSaved(): SavedPalette[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadActive(): Required<Palette> {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? { ...DEFAULT_PALETTE, ...JSON.parse(raw) } : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota or private mode: keep in memory
  }
}

/** The active palette (applied to the graph) plus the user's saved palettes. */
export function usePalettes() {
  const [active, setActiveState] = useState<Required<Palette>>(loadActive)
  const [saved, setSaved] = useState<SavedPalette[]>(loadSaved)

  const setActive = useCallback((palette: Required<Palette>) => {
    setActiveState(palette)
    persist(ACTIVE_KEY, palette)
  }, [])

  const setColor = useCallback((key: keyof Palette, value: string) => {
    setActiveState((prev) => {
      const next = { ...prev, [key]: value }
      persist(ACTIVE_KEY, next)
      return next
    })
  }, [])

  const save = useCallback(
    (name: string) => {
      setSaved((prev) => {
        const entry: SavedPalette = {
          id: crypto.randomUUID?.() ?? String(Date.now()),
          name,
          palette: active,
        }
        const next = [...prev.filter((p) => p.name !== name), entry]
        persist(SAVED_KEY, next)
        return next
      })
    },
    [active]
  )

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((p) => p.id !== id)
      persist(SAVED_KEY, next)
      return next
    })
  }, [])

  const isDefault = JSON.stringify(active) === JSON.stringify(DEFAULT_PALETTE)

  return {
    active,
    saved,
    presets: PALETTE_PRESETS,
    setActive,
    setColor,
    save,
    remove,
    isDefault,
  }
}
