import { FileJson2, PanelLeftClose, Plus, Trash2 } from "lucide-react"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Session } from "@/sessions"

interface SessionSidebarProps {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onRemove: (id: string) => void
  onClear: () => void
  onNew: () => void
  onCollapse: () => void
  showingInput: boolean
}

export function SessionSidebar({
  sessions,
  selectedId,
  onSelect,
  onRemove,
  onClear,
  onNew,
  onCollapse,
  showingInput,
}: SessionSidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-card">
      {/* Same height as the toolbar, so the two header rows line up. */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b px-3">
        <Logo />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold">turnmap</div>
          <div className="truncate text-[11px] text-muted-foreground">
            Pydantic AI history visualizer
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="Hide sidebar"
              onClick={onCollapse}
            >
              <PanelLeftClose />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hide sidebar</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Sessions
        </span>
        <Button
          variant={showingInput ? "secondary" : "ghost"}
          size="sm"
          onClick={onNew}
          aria-label="New session"
        >
          <Plus /> New
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No sessions yet. Paste a history or load an example.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((session) => {
              const active = session.id === selectedId && !showingInput
              return (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      active && "bg-accent"
                    )}
                  >
                    <span className="flex w-full items-center gap-1.5 pr-6">
                      <FileJson2 className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{session.name}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {session.messages.length} messages ·{" "}
                      {new Date(session.createdAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Delete ${session.name}`}
                    onClick={() => onRemove(session.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
      {sessions.length > 0 && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={onClear}
          >
            Clear all sessions
          </Button>
        </div>
      )}
      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Sessions live in this browser only. Nothing is uploaded.
      </div>
    </aside>
  )
}
