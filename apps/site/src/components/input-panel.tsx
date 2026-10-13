import { parseMessages, TurnMapParseError } from "turnmap"
import { AlertCircle, FileUp, Sparkles } from "lucide-react"
import { useCallback, useRef, useState, type DragEvent } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EXAMPLES } from "@/examples"
import { cn } from "@/lib/utils"

interface InputPanelProps {
  onSubmit: (name: string, messages: unknown[]) => void
}

export function InputPanel({ onSubmit }: InputPanelProps) {
  const [text, setText] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const submit = useCallback(
    (raw: string, label?: string) => {
      try {
        const { messages, warnings } = parseMessages(raw)
        setWarnings(warnings)
        setError(null)
        onSubmit(
          label || name.trim() || `Session ${new Date().toLocaleTimeString()}`,
          messages
        )
        setText("")
        setName("")
      } catch (err) {
        setError(
          err instanceof TurnMapParseError
            ? err.message
            : (err as Error).message
        )
      }
    },
    [name, onSubmit]
  )

  const readFile = useCallback(
    (file: File) => {
      file
        .text()
        .then((content) => submit(content, file.name.replace(/\.json$/i, "")))
        .catch((err) => setError((err as Error).message))
    },
    [submit]
  )

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          See what your Pydantic AI agent actually did
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the output of{" "}
          <code className="rounded bg-muted px-1">
            result.all_messages_json()
          </code>{" "}
          and get every prompt, model response, tool call, tool return and retry
          as a graph. Everything runs in your browser.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-dashed p-4 transition-colors",
          dragging && "border-ring bg-accent/40"
        )}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='[{"parts": [{"content": "...", "part_kind": "user-prompt"}], "kind": "request"}, ...]'
          spellCheck={false}
          className="min-h-48 font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Session name (optional)"
            className="h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) readFile(file)
              e.target.value = ""
            }}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <FileUp /> Open file
          </Button>
          <Button onClick={() => submit(text)} disabled={!text.trim()}>
            Visualize
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Drop a .json file anywhere in this box. Accepted shapes: the plain
          message array, <code>{"{ messages: [...] }"}</code>, or rows of{" "}
          <code>{"{ message: {...} }"}</code>.
        </p>
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <ul className="list-disc rounded-md bg-muted p-3 pl-7 text-xs text-muted-foreground">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5" /> Or load an example
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => onSubmit(example.name, example.messages)}
              className="cursor-pointer rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="text-sm font-medium">{example.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {example.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
