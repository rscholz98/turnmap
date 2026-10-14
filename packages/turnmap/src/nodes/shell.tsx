import { Handle, Position } from "@xyflow/react"
import type { CSSProperties, ReactNode } from "react"

import { cn } from "../cn"
import { useTurnMapSettings } from "../context"
import { HANDLE, NODE_WIDTH } from "../layout"
import { ExpandDialog } from "../ui/dialog"

export { CodeBlock, TextBlock } from "./blocks"

interface NodeShellProps {
  accent: string
  icon: ReactNode
  title: ReactNode
  /** Small badges rendered after the title. */
  badges?: ReactNode
  /** Footer line (timestamps, ids). */
  footer?: ReactNode
  children?: ReactNode
  /** Full, untruncated content for the expand dialog; omit to hide the button. */
  expand?: ReactNode
  expandTitle?: ReactNode
  className?: string
  style?: CSSProperties
}

const SIDES = [
  { pos: Position.Top, s: HANDLE.source.top, t: HANDLE.target.top },
  { pos: Position.Bottom, s: HANDLE.source.bottom, t: HANDLE.target.bottom },
  { pos: Position.Left, s: HANDLE.source.left, t: HANDLE.target.left },
  { pos: Position.Right, s: HANDLE.source.right, t: HANDLE.target.right },
]

/**
 * Every node renders a source and a target handle on each side. The layout
 * decides per edge which pair to use, so a layout switch only re-routes
 * edges and never leaves them on a stale anchor.
 */
function Handles() {
  return (
    <>
      {SIDES.map(({ pos, s, t }) => (
        <span key={pos}>
          <Handle
            type="source"
            id={s}
            position={pos}
            isConnectable={false}
            className="tm-handle"
          />
          <Handle
            type="target"
            id={t}
            position={pos}
            isConnectable={false}
            className="tm-handle"
          />
        </span>
      ))}
    </>
  )
}

export function NodeShell({
  accent,
  icon,
  title,
  badges,
  footer,
  children,
  expand,
  expandTitle,
  className,
  style,
}: NodeShellProps) {
  const { dark } = useTurnMapSettings()
  return (
    <div
      className={cn(
        "tm-node tm:relative tm:flex tm:flex-col tm:gap-2 tm:rounded-lg tm:border tm:border-border tm:bg-card tm:p-3 tm:text-foreground tm:shadow-sm",
        className
      )}
      style={{
        width: NODE_WIDTH,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        ...style,
      }}
    >
      <Handles />
      <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-2 tm:pr-6">
        <span
          className="tm:flex tm:h-6 tm:w-6 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md"
          style={{
            color: accent,
            background: `color-mix(in oklch, ${accent} 14%, transparent)`,
          }}
        >
          {icon}
        </span>
        <span className="tm:min-w-0 tm:truncate tm:text-[13px] tm:font-semibold">
          {title}
        </span>
        {badges && (
          <span className="tm:ml-auto tm:flex tm:shrink-0 tm:items-center tm:gap-1">
            {badges}
          </span>
        )}
      </div>
      {children && <div className="tm:min-w-0 tm:text-[13px]">{children}</div>}
      {footer && (
        <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-x-2 tm:gap-y-0.5 tm:text-[11px] tm:text-muted-foreground">
          {footer}
        </div>
      )}
      {expand && (
        <ExpandDialog
          title={expandTitle ?? title}
          rootClassName={dark ? "dark" : undefined}
        >
          {expand}
        </ExpandDialog>
      )}
    </div>
  )
}
