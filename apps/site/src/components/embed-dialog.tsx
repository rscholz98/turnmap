import { Code2 } from "lucide-react"

import { Code } from "@/components/code"
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

const USAGE = `import { useState } from "react"
import { TurnMap } from "turnmap"
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
        <TurnMap messages={current.messages} layout="spine" theme="system" />
      </div>
    </div>
  )
}`

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
        <Code code={INSTALL} language="bash" />
        <Code code={USAGE} language="tsx" className="max-h-[50vh]" />
        <p className="text-xs text-muted-foreground">
          Props: <code>messages</code>, <code>layout</code> (spine, TB or LR),{" "}
          <code>theme</code>, <code>palette</code>,{" "}
          <code>collapseThreshold</code>, <code>onSelect</code>,{" "}
          <code>showMinimap</code>, <code>showControls</code>. Full docs in the{" "}
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
