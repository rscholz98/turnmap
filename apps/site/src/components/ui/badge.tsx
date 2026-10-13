import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export function Badge({
  className,
  variant = "secondary",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: "secondary" | "outline" | "destructive"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "outline" && "border text-foreground",
        variant === "destructive" && "bg-destructive/15 text-destructive",
        className
      )}
      {...props}
    />
  )
}
