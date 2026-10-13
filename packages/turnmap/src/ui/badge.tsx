import type { HTMLAttributes } from "react"

import { cn } from "../cn"

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info"

const TONES: Record<BadgeTone, string> = {
  neutral: "tm:bg-muted tm:text-muted-foreground",
  success: "tm:bg-accent-response/15 tm:text-accent-response",
  danger: "tm:bg-accent-retry/15 tm:text-accent-retry",
  warning: "tm:bg-accent-thinking/20 tm:text-accent-thinking",
  info: "tm:bg-accent-user/15 tm:text-accent-user",
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "tm:inline-flex tm:items-center tm:gap-1 tm:rounded-md tm:px-1.5 tm:py-0.5 tm:text-[11px] tm:font-medium tm:leading-4 tm:whitespace-nowrap",
        TONES[tone],
        className
      )}
      {...props}
    />
  )
}
