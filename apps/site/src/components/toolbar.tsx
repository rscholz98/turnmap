import {
  ArrowDownUp,
  ArrowLeftRight,
  Check,
  GitFork,
  Link2,
  Moon,
  PanelLeftOpen,
  Pencil,
  Sun,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { LayoutMode } from "turnmap"

import { EmbedDialog } from "@/components/embed-dialog"
import { Logo } from "@/components/logo"
import { PaletteMenu } from "@/components/palette-menu"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { usePalettes } from "@/palettes"
import type { Session } from "@/sessions"
import { SHARE_LINK_SOFT_LIMIT, shareUrl } from "@/share"

interface ToolbarProps {
  session: Session | null
  layout: LayoutMode
  onLayout: (m: LayoutMode) => void
  dark: boolean
  onToggleTheme: () => void
  onRename: (id: string, name: string) => void
  palettes: ReturnType<typeof usePalettes>
  sidebarOpen: boolean
  onOpenSidebar: () => void
}

const LAYOUTS: { mode: LayoutMode; label: string; icon: typeof GitFork }[] = [
  {
    mode: "spine",
    label: "Spine: tools beside the conversation",
    icon: GitFork,
  },
  { mode: "TB", label: "Top-down", icon: ArrowDownUp },
  { mode: "LR", label: "Left-right", icon: ArrowLeftRight },
]

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

function Tip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function Toolbar({
  session,
  layout,
  onLayout,
  dark,
  onToggleTheme,
  onRename,
  palettes,
  sidebarOpen,
  onOpenSidebar,
}: ToolbarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const share = async () => {
    if (!session) return
    const url = shareUrl(session.messages)
    try {
      await navigator.clipboard.writeText(url)
      if (url.length > SHARE_LINK_SOFT_LIMIT) {
        toast.warning("Link copied, but it is very long", {
          description: `${(url.length / 1000).toFixed(0)}k characters. Some chat apps truncate links this size; share the JSON file instead if it breaks.`,
        })
      } else {
        toast.success("Share link copied", {
          description:
            "The whole history is encoded in the link. No server involved.",
        })
      }
    } catch {
      toast.error("Could not copy the link", {
        description: url.slice(0, 80) + "…",
      })
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
      {!sidebarOpen && (
        <>
          <Logo />
          <Tip label="Show sidebar">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Show sidebar"
              onClick={onOpenSidebar}
            >
              <PanelLeftOpen />
            </Button>
          </Tip>
          <span className="mx-1 h-5 w-px bg-border" />
        </>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {session && editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.trim()) onRename(session.id, draft.trim())
              setEditing(false)
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setEditing(false)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              aria-label="Save name"
            >
              <Check />
            </Button>
          </form>
        ) : session ? (
          <button
            type="button"
            className="group flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1 text-sm font-medium hover:bg-accent"
            onClick={() => {
              setDraft(session.name)
              setEditing(true)
            }}
            title="Rename"
          >
            <span className="truncate">{session.name}</span>
            <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">New session</span>
        )}
        {session && (
          <span className="text-xs text-muted-foreground">
            {session.messages.length} messages
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {session && (
          <>
            <div
              className="mr-1 flex items-center rounded-md border p-0.5"
              role="group"
              aria-label="Layout"
            >
              {LAYOUTS.map(({ mode, label, icon: Icon }) => (
                <Tip key={mode} label={label}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "size-7",
                      layout === mode && "bg-accent text-accent-foreground"
                    )}
                    aria-label={label}
                    aria-pressed={layout === mode}
                    onClick={() => onLayout(mode)}
                  >
                    <Icon />
                  </Button>
                </Tip>
              ))}
            </div>
            <PaletteMenu palettes={palettes} />
            <Tip label="Copy a share link (the history is encoded in the URL)">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Share"
                onClick={share}
              >
                <Link2 />
              </Button>
            </Tip>
          </>
        )}
        <Tip label={dark ? "Light theme" : "Dark theme"}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle theme"
            onClick={onToggleTheme}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
        </Tip>
        <EmbedDialog />
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href="https://github.com/rscholz98/turnmap"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
          >
            <GithubIcon />
          </a>
        </Button>
      </div>
    </header>
  )
}
