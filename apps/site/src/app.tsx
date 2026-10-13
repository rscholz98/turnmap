import { TurnMap, type Direction } from "turnmap"
import { useCallback, useEffect, useState } from "react"
import { Toaster, toast } from "sonner"

import { InputPanel } from "@/components/input-panel"
import { SessionSidebar } from "@/components/session-sidebar"
import { Toolbar } from "@/components/toolbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSessions } from "@/sessions"
import { useTheme } from "@/theme"

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
  const [direction, setDirection] = useState<Direction>("TB")
  const [showingInput, setShowingInput] = useState(() => !selected)

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
          showingInput={showInput}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Toolbar
            session={showInput ? null : selected}
            direction={direction}
            onDirection={setDirection}
            dark={dark}
            onToggleTheme={toggle}
            onRename={rename}
          />
          <div className="min-h-0 flex-1">
            {showInput ? (
              <InputPanel onSubmit={onSubmit} />
            ) : (
              <TurnMap
                messages={selected!.messages}
                direction={direction}
                theme={dark ? "dark" : "light"}
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
