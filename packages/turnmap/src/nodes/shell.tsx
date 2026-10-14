import { Handle, Position } from "@xyflow/react"
import { ChevronDown, PanelRightOpen } from "lucide-react"
import { useState, type CSSProperties, type ReactNode } from "react"

import { cn } from "../cn"
import { useTurnMapSettings } from "../context"
import { HANDLE, NODE_WIDTH } from "../layout"
import { IconButton } from "../ui/button"

export { CodeBlock, TextBlock } from "./blocks"

interface NodeShellProps {
  /** React Flow node id; enables the "open in panel" button. */
  nodeId: string
  accent: string
  icon: ReactNode
  title: ReactNode
  /** One line under the title, truncated. The node's "at a glance" content. */
  summary?: ReactNode
  /** Small badges at the end of the header row. */
  badges?: ReactNode
  /** Details section, shown when the node is opened (chevron or click). */
  children?: ReactNode
  /** Footer line inside the details (timestamps, ids). */
  footer?: ReactNode
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
 * header row; the details open underneath on demand. Opening changes the
 * node height, which the canvas re-measures and lays out again.
 */
export function NodeShell({
  nodeId,
  accent,
  icon,
  title,
  summary,
  badges,
  children,
  footer,
  className,
  style,
}: NodeShellProps) {
  const { expandNodes, activeId, openNode } = useTurnMapSettings()
  const [toggled, setToggled] = useState<boolean | null>(null)
  const open = toggled ?? expandNodes
  const hasDetails = children != null || footer != null
  const active = activeId === nodeId
  return (
    <div
      className={cn(
        "tm-node tm:relative tm:rounded-lg tm:border tm:border-border tm:bg-card tm:text-foreground tm:shadow-sm",
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
    >
      <Handles />
      <div
        className={cn(
          "tm:flex tm:items-center tm:gap-2 tm:px-2.5 tm:py-1.5",
          hasDetails && "nodrag tm:cursor-pointer"
        )}
        onClick={hasDetails ? () => setToggled(!open) : undefined}
      >
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
        <span
          className="tm:flex tm:shrink-0 tm:items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            className="nodrag tm:h-5 tm:w-5"
            aria-label="Open in side panel"
            onClick={() => openNode(nodeId)}
          >
            <PanelRightOpen className="tm:h-3 tm:w-3" />
          </IconButton>
          {hasDetails && (
            <IconButton
              className="nodrag tm:h-5 tm:w-5"
              aria-label={open ? "Hide details" : "Show details"}
              aria-expanded={open}
              onClick={() => setToggled(!open)}
            >
              <ChevronDown
                className={cn(
                  "tm:h-3.5 tm:w-3.5 tm:transition-transform",
                  open && "tm:rotate-180"
                )}
              />
            </IconButton>
          )}
        </span>
      </div>
      {open && hasDetails && (
        <div className="tm:flex tm:flex-col tm:gap-2 tm:border-t tm:border-border tm:px-2.5 tm:py-2 tm:text-[12px]">
          {children}
          {footer && (
            <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-x-2 tm:gap-y-0.5 tm:text-[10px] tm:text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
