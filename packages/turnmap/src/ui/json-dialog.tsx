import { Dialog as DialogPrimitive } from "radix-ui"
import { Check, Copy, Maximize2, X } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cn } from "../cn"
import { useTurnMapSettings } from "../context"
import { HighlightedJson } from "../nodes/blocks"
import { IconButton } from "./button"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <IconButton
      aria-label="Copy JSON"
      onClick={async () => {
        await navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <Check className="tm:h-4 tm:w-4" />
      ) : (
        <Copy className="tm:h-4 tm:w-4" />
      )}
    </IconButton>
  )
}

/**
 * Expand button that opens a large modal with the full, syntax-colored JSON
 * (or text) for review and copying.
 */
export function JsonDialog({
  title,
  text,
  className,
}: {
  title: ReactNode
  text: string
  className?: string
}) {
  const { dark } = useTurnMapSettings()
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <IconButton
          className={cn("tm:h-5 tm:w-5", className)}
          aria-label="Open full JSON"
        >
          <Maximize2 className="tm:h-3 tm:w-3" />
        </IconButton>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <div
          className={cn("turnmap", dark && "dark")}
          style={{ background: "transparent" }}
        >
          <DialogPrimitive.Overlay className="tm:fixed tm:inset-0 tm:z-[1000] tm:bg-black/50" />
          <DialogPrimitive.Content className="tm:fixed tm:top-1/2 tm:left-1/2 tm:z-[1001] tm:flex tm:h-[88vh] tm:w-[min(96vw,1200px)] tm:-translate-x-1/2 tm:-translate-y-1/2 tm:flex-col tm:gap-3 tm:rounded-xl tm:border tm:border-border tm:bg-card tm:p-5 tm:text-foreground tm:shadow-2xl tm:focus:outline-none">
            <div className="tm:flex tm:items-center tm:justify-between tm:gap-3">
              <DialogPrimitive.Title className="tm:m-0 tm:min-w-0 tm:truncate tm:text-base tm:font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="tm:sr-only">
                Full JSON
              </DialogPrimitive.Description>
              <span className="tm:flex tm:shrink-0 tm:items-center tm:gap-1">
                <CopyButton text={text} />
                <DialogPrimitive.Close asChild>
                  <IconButton aria-label="Close">
                    <X className="tm:h-4 tm:w-4" />
                  </IconButton>
                </DialogPrimitive.Close>
              </span>
            </div>
            <pre className="tm:min-h-0 tm:flex-1 tm:overflow-auto tm:rounded-md tm:bg-code tm:p-4 tm:text-[12px]">
              <HighlightedJson text={text} />
            </pre>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
