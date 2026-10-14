import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp } from "lucide-react"

import { IconButton } from "./ui/button"

/**
 * Prev / next / first / last node control, shown in the canvas corner. The
 * same moves are bound to the arrow keys, Home and End on the container.
 */
export function NodeNav({
  index,
  total,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: {
  index: number
  total: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}) {
  const atStart = index <= 0
  const atEnd = index >= total - 1
  return (
    <div
      className="tm-nav tm:flex tm:items-center tm:gap-0.5 tm:rounded-lg tm:border tm:border-border tm:bg-card tm:p-0.5 tm:text-foreground tm:shadow-sm"
      role="group"
      aria-label="Node navigation"
    >
      <IconButton
        className="tm:h-7 tm:w-7"
        aria-label="First node (Home)"
        disabled={atStart}
        onClick={onFirst}
      >
        <ChevronsUp className="tm:h-4 tm:w-4" />
      </IconButton>
      <IconButton
        className="tm:h-7 tm:w-7"
        aria-label="Previous node (Arrow up)"
        disabled={atStart}
        onClick={onPrev}
      >
        <ChevronUp className="tm:h-4 tm:w-4" />
      </IconButton>
      <span
        className="tm:min-w-[3.5rem] tm:px-1 tm:text-center tm:text-[11px] tm:tabular-nums tm:text-muted-foreground"
        aria-live="polite"
      >
        {total === 0 ? "0 / 0" : `${index < 0 ? "–" : index + 1} / ${total}`}
      </span>
      <IconButton
        className="tm:h-7 tm:w-7"
        aria-label="Next node (Arrow down)"
        disabled={atEnd}
        onClick={onNext}
      >
        <ChevronDown className="tm:h-4 tm:w-4" />
      </IconButton>
      <IconButton
        className="tm:h-7 tm:w-7"
        aria-label="Last node (End)"
        disabled={atEnd}
        onClick={onLast}
      >
        <ChevronsDown className="tm:h-4 tm:w-4" />
      </IconButton>
    </div>
  )
}
