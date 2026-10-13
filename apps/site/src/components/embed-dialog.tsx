import { Check, Code2, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const INSTALL = "npm install turnmap"

const USAGE = `import { TurnMap } from "turnmap"
import "turnmap/styles.css"

// sessions: your own list of histories, e.g. loaded from a database
export function Trace({ sessions }) {
  const [current, setCurrent] = useState(sessions[0])
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <aside>
        {sessions.map((s) => (
          <button key={s.id} onClick={() => setCurrent(s)}>
            {s.name}
          </button>
        ))}
      </aside>
      <div style={{ flex: 1 }}>
        <TurnMap messages={current.messages} theme="system" />
      </div>
    </div>
  )
}`

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="absolute top-1.5 right-1.5"
      aria-label="Copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

export function EmbedDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Code2 /> Embed
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Use turnmap in your own app</DialogTitle>
          <DialogDescription>
            A React component with no backend. Pass it a history, it draws the
            graph. Switching sessions is your call: pass a different history.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {INSTALL}
          </pre>
          <CopyButton text={INSTALL} />
        </div>
        <div className="relative">
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {USAGE}
          </pre>
          <CopyButton text={USAGE} />
        </div>
        <p className="text-xs text-muted-foreground">
          Props: <code>messages</code>, <code>direction</code> (TB or LR),{" "}
          <code>theme</code>, <code>collapseThreshold</code>,{" "}
          <code>onSelect</code>, <code>showMinimap</code>,{" "}
          <code>showControls</code>. Full docs in the{" "}
          <a
            className="underline"
            href="https://github.com/rscholz98/turnmap#readme"
            target="_blank"
            rel="noreferrer"
          >
            README
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  )
}
