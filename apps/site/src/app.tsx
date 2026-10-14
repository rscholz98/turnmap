import { TurnMap, type LayoutMode } from "turnmap"
import { useCallback, useEffect, useState } from "react"
import { Toaster, toast } from "sonner"

import { InputPanel } from "@/components/input-panel"
import { SessionSidebar } from "@/components/session-sidebar"
import { Toolbar } from "@/components/toolbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePalettes } from "@/palettes"
import { useSessions } from "@/sessions"
import { useTheme } from "@/theme"

const LAYOUT_KEY = "turnmap.layout"
const SIDEBAR_KEY = "turnmap.sidebar"

function stored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  try {
    const v = localStorage.getItem(key)
    return (allowed as readonly string[]).includes(v ?? "")
      ? (v as T)
      : fallback
  } catch {
    return fallback
  }
}

export function App() {
  const {
    sessions,
    selected,
    select,
    add,
    remove,
    rename,
    clear,
    persistError,
  } = useSessions()
  const { dark, toggle } = useTheme()
  const palettes = usePalettes()
  const [layout, setLayoutState] = useState<LayoutMode>(() => {
    const fromUrl = new URLSearchParams(location.search).get("layout")
    if (fromUrl === "spine" || fromUrl === "TB" || fromUrl === "LR")
      return fromUrl
    return stored(LAYOUT_KEY, ["spine", "TB", "LR"] as const, "spine")
  })
  const [sidebarOpen, setSidebarOpenState] = useState(
    () => stored(SIDEBAR_KEY, ["open", "closed"] as const, "open") === "open"
  )
  const [showingInput, setShowingInput] = useState(() => !selected)
  const [expandNodes, setExpandNodes] = useState(
    () => new URLSearchParams(location.search).get("expand") === "1"
  )

  const setLayout = useCallback((m: LayoutMode) => {
    setLayoutState(m)
    try {
      localStorage.setItem(LAYOUT_KEY, m)
    } catch {
      // ignore
    }
  }, [])

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open)
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed")
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (persistError) toast.warning(persistError)
  }, [persistError])

  const onSubmit = useCallback(
    (name: string, messages: unknown[]) => {
      add(name, messages)
      setShowingInput(false)
    },
    [add]
  )

  const showInput = showingInput || !selected

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full">
        {sidebarOpen && (
          <SessionSidebar
            sessions={sessions}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              select(id)
              setShowingInput(false)
            }}
            onRemove={remove}
            onClear={clear}
            onNew={() => setShowingInput(true)}
            onCollapse={() => setSidebarOpen(false)}
            showingInput={showInput}
          />
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            session={showInput ? null : selected}
            layout={layout}
            onLayout={setLayout}
            dark={dark}
            onToggleTheme={toggle}
            onRename={rename}
            expandNodes={expandNodes}
            onExpandNodes={setExpandNodes}
            palettes={palettes}
            sidebarOpen={sidebarOpen}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <div className="min-h-0 flex-1">
            {showInput ? (
              <InputPanel onSubmit={onSubmit} />
            ) : (
              <TurnMap
                messages={selected!.messages}
                layout={layout}
                theme={dark ? "dark" : "light"}
                palette={palettes.active}
                expandNodes={expandNodes}
              />
            )}
          </div>
        </main>
      </div>
      <Toaster
        richColors
        position="bottom-center"
        theme={dark ? "dark" : "light"}
      />
    </TooltipProvider>
  )
}
