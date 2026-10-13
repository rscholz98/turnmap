import { useCallback, useEffect, useState } from "react"

import { decodeShare } from "@/share"

/**
 * The session model the site uses, and the pattern consumers copy: a list of
 * histories, one selected, the `TurnMap` component rendering the selection.
 */
export interface Session {
  id: string
  name: string
  createdAt: string
  messages: unknown[]
}

const STORAGE_KEY = "turnmap.sessions"
const SELECTED_KEY = "turnmap.selected"

function load(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function newSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Initial state: the stored sessions, plus a session imported from a share
 * link when the URL carries one (the hash is cleared so a reload does not
 * import it twice).
 */
function initialState(): { sessions: Session[]; selectedId: string | null } {
  const sessions = load()
  const shared = decodeShare(location.hash)
  if (!shared) return { sessions, selectedId: loadSelected() }
  history.replaceState(null, "", location.pathname + location.search)
  const session: Session = {
    id: newSessionId(),
    name: "Shared link",
    createdAt: new Date().toISOString(),
    messages: shared,
  }
  return { sessions: [session, ...sessions], selectedId: session.id }
}

export function useSessions() {
  const [initial] = useState(initialState)
  const [sessions, setSessions] = useState<Session[]>(initial.sessions)
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.selectedId
  )
  const [persistError, setPersistError] = useState<string | null>(null)

  // Write-through to localStorage; a quota error keeps the state in memory
  // and surfaces once as a warning.
  const update = useCallback((updater: (prev: Session[]) => Session[]) => {
    setSessions((prev) => {
      const next = updater(prev)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setPersistError(null)
      } catch (error) {
        setPersistError(
          `Sessions are kept in memory only: ${(error as Error).message}`
        )
      }
      return next
    })
  }, [])

  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
      else localStorage.removeItem(SELECTED_KEY)
    } catch {
      // ignore
    }
  }, [selectedId])

  const add = useCallback(
    (name: string, messages: unknown[]) => {
      const session: Session = {
        id: newSessionId(),
        name,
        createdAt: new Date().toISOString(),
        messages,
      }
      update((prev) => [session, ...prev])
      setSelectedId(session.id)
      return session
    },
    [update]
  )

  const remove = useCallback(
    (id: string) => {
      update((prev) => prev.filter((s) => s.id !== id))
      setSelectedId((current) => (current === id ? null : current))
    },
    [update]
  )

  const rename = useCallback(
    (id: string, name: string) => {
      update((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    },
    [update]
  )

  const clear = useCallback(() => {
    update(() => [])
    setSelectedId(null)
  }, [update])

  const selected = sessions.find((s) => s.id === selectedId) ?? null

  return {
    sessions,
    selected,
    select: setSelectedId,
    add,
    remove,
    rename,
    clear,
    persistError,
  }
}
