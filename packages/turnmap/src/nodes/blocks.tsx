import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

import { cn } from "../cn"
import { looksLikeJson, tokenizeJson, type JsonTokenKind } from "./format"

const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: "tm:text-accent-user",
  string: "tm:text-accent-response",
  number: "tm:text-accent-thinking",
  literal: "tm:text-accent-tool-call",
  punct: "tm:text-muted-foreground",
  text: "",
}

export function HighlightedJson({ text }: { text: string }) {
  if (!looksLikeJson(text)) return <>{text}</>
  return (
    <>
      {tokenizeJson(text).map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.kind] || undefined}>
          {t.text}
        </span>
      ))}
    </>
  )
}

/** "Show more" / "Show less" toggle; `nodrag` keeps the click off the canvas. */
function MoreToggle({
  open,
  onToggle,
  hidden,
}: {
  open: boolean
  onToggle: () => void
  hidden: number
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="nodrag tm:mt-1 tm:inline-flex tm:cursor-pointer tm:items-center tm:gap-1 tm:rounded-md tm:border-0 tm:bg-transparent tm:px-1 tm:py-0.5 tm:text-[11px] tm:font-medium tm:text-muted-foreground tm:hover:bg-muted tm:hover:text-foreground"
    >
      {open ? (
        <ChevronUp className="tm:h-3 tm:w-3" />
      ) : (
        <ChevronDown className="tm:h-3 tm:w-3" />
      )}
      {open ? "Show less" : `Show more (${hidden.toLocaleString()} more chars)`}
    </button>
  )
}

/**
 * Plain text that is cut at `limit` characters and can be expanded in place.
 * Expanding changes the node's height, which the canvas re-measures and
 * re-lays out.
 */
export function TextBlock({
  text,
  limit = 500,
}: {
  text: string
  limit?: number
}) {
  const [open, setOpen] = useState(false)
  if (!text.trim()) {
    return <p className="tm:m-0 tm:text-muted-foreground tm:italic">(empty)</p>
  }
  const long = text.length > limit
  const shown = open || !long ? text : `${text.slice(0, limit).trimEnd()} …`
  return (
    <div className="tm:min-w-0">
      <p className="tm:m-0 tm:break-words tm:whitespace-pre-wrap">{shown}</p>
      {long && (
        <MoreToggle
          open={open}
          onToggle={() => setOpen((v) => !v)}
          hidden={text.length - limit}
        />
      )}
    </div>
  )
}

/** Code (JSON or other) with syntax colors for JSON and an in-place expand. */
export function CodeBlock({
  text,
  limit = 500,
  className,
}: {
  text: string
  limit?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const long = text.length > limit
  const shown = open || !long ? text : `${text.slice(0, limit).trimEnd()}\n…`
  return (
    <div className="tm:min-w-0">
      <pre
        className={cn(
          "tm:overflow-hidden tm:rounded-md tm:bg-code tm:p-2",
          className
        )}
      >
        <HighlightedJson text={shown} />
      </pre>
      {long && (
        <MoreToggle
          open={open}
          onToggle={() => setOpen((v) => !v)}
          hidden={text.length - limit}
        />
      )}
    </div>
  )
}
