import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import { ChevronRight } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cn } from "../cn"

export function CollapsibleBlock({
  label,
  defaultOpen = true,
  children,
  className,
}: {
  label: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <CollapsiblePrimitive.Root
      open={open}
      onOpenChange={setOpen}
      className={cn("tm:flex tm:min-w-0 tm:flex-col tm:gap-1", className)}
    >
      <CollapsiblePrimitive.Trigger className="nodrag tm:flex tm:w-full tm:cursor-pointer tm:items-center tm:gap-1 tm:rounded-md tm:border-0 tm:bg-transparent tm:px-0 tm:py-0.5 tm:text-left tm:text-[11px] tm:font-medium tm:text-muted-foreground tm:hover:text-foreground">
        <ChevronRight
          className={cn(
            "tm:h-3 tm:w-3 tm:transition-transform",
            open && "tm:rotate-90"
          )}
        />
        {label}
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content>{children}</CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
