import { Handle, Position } from "@xyflow/react"
import type { CSSProperties, ReactNode } from "react"

import { cn } from "../cn"
import { useTurnMapSettings } from "../context"
import { HANDLE, NODE_WIDTH } from "../layout"

interface NodeShellProps {
  /** React Flow node id; a click opens the node in the side panel. */
  nodeId: string
  accent: string
  icon: ReactNode
  title: ReactNode
  /** One line under the title, truncated. The node's "at a glance" content. */
  summary?: ReactNode
  /** Small badges at the end of the header row. */
  badges?: ReactNode
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

/**
 * Compact node: an icon, a title, a one-line summary and badges in a single
 * row. Nothing opens inside the canvas; a click opens the side panel.
 */
export function NodeShell({
  nodeId,
  accent,
  icon,
  title,
  summary,
  badges,
  className,
  style,
}: NodeShellProps) {
  const { activeId, openNode } = useTurnMapSettings()
  const active = activeId === nodeId
  return (
    <div
      className={cn(
        "tm-node tm:relative tm:flex tm:cursor-pointer tm:items-center tm:gap-2 tm:rounded-lg tm:border tm:border-border tm:bg-card tm:px-2.5 tm:py-1.5 tm:text-foreground tm:shadow-sm tm:transition-shadow tm:hover:shadow-md",
        active && "tm-node-active",
        className
      )}
      style={{
        width: NODE_WIDTH,
        borderLeftWidth: 3,
        borderLeftColor: accent,
        ...style,
      }}
      data-active={active || undefined}
      role="button"
      tabIndex={-1}
      aria-label={typeof title === "string" ? title : undefined}
      onClick={() => openNode(nodeId)}
    >
      <Handles />
      <span
        className="tm:flex tm:h-6 tm:w-6 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-md"
        style={{
          color: accent,
          background: `color-mix(in oklch, ${accent} 14%, transparent)`,
        }}
      >
        {icon}
      </span>
      <div className="tm:min-w-0 tm:flex-1 tm:leading-tight">
        <div className="tm:truncate tm:text-[12px] tm:font-semibold">
          {title}
        </div>
        {summary != null && (
          <div className="tm:truncate tm:text-[11px] tm:text-muted-foreground">
            {summary}
          </div>
        )}
      </div>
      {badges && (
        <span className="tm:flex tm:shrink-0 tm:items-center tm:gap-1">
          {badges}
        </span>
      )}
    </div>
  )
}
