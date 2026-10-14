import { Workflow } from "lucide-react"

import { cn } from "@/lib/utils"

/** The turnmap mark: the Workflow icon, also used as the favicon. */
export function Logo({ className }: { className?: string }) {
  return (
    <Workflow className={cn("size-5 shrink-0", className)} aria-hidden="true" />
  )
}
