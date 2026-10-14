import { Dialog as DialogPrimitive } from "radix-ui"
import { Maximize2, X } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "../cn"
import { IconButton } from "./button"

/**
 * Expand control shown in every node header: opens the full, untruncated
 * content in a large dialog. `nodrag` keeps the click from starting a canvas drag.
 */
export function ExpandDialog({
  title,
  children,
  rootClassName,
  className,
}: {
  title: ReactNode
  children: ReactNode
  /** Class names to carry the `.turnmap` theme scope into the portal. */
  rootClassName?: string
  className?: string
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <IconButton
          className={cn("nodrag tm:h-5 tm:w-5", className)}
          aria-label="Open in dialog"
        >
          <Maximize2 className="tm:h-3 tm:w-3" />
        </IconButton>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <div
          className={cn("turnmap", rootClassName)}
          style={{ background: "transparent" }}
        >
          <DialogPrimitive.Overlay className="tm:fixed tm:inset-0 tm:z-[1000] tm:bg-black/50" />
          <DialogPrimitive.Content className="tm:fixed tm:top-1/2 tm:left-1/2 tm:z-[1001] tm:flex tm:h-[85vh] tm:w-[min(95vw,1100px)] tm:-translate-x-1/2 tm:-translate-y-1/2 tm:flex-col tm:gap-3 tm:rounded-xl tm:border tm:border-border tm:bg-card tm:p-5 tm:text-foreground tm:shadow-2xl tm:focus:outline-none">
            <div className="tm:flex tm:items-start tm:justify-between tm:gap-3">
              <DialogPrimitive.Title className="tm:m-0 tm:text-base tm:font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="tm:sr-only">
                Full content of the selected node
              </DialogPrimitive.Description>
              <DialogPrimitive.Close asChild>
                <IconButton aria-label="Close">
                  <X className="tm:h-4 tm:w-4" />
                </IconButton>
              </DialogPrimitive.Close>
            </div>
            <div className="tm:min-h-0 tm:flex-1 tm:overflow-auto">
              {children}
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
