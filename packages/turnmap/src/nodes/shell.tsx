import { Handle, Position } from "@xyflow/react"
import type { CSSProperties, ReactNode } from "react"

import { cn } from "../cn"
import { useTurnMapSettings } from "../context"
import { NODE_WIDTH } from "../layout"
import { ExpandDialog } from "../ui/dialog"
import { preview } from "./format"

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
  const { direction, dark } = useTurnMapSettings()
  const vertical = direction === "TB"
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
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        isConnectable={false}
      />
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
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        isConnectable={false}
      />
    </div>
  )
}

export function TextBlock({ text, limit }: { text: string; limit?: number }) {
  if (!text.trim()) {
    return <p className="tm:m-0 tm:text-muted-foreground tm:italic">(empty)</p>
  }
  return (
    <p className="tm:m-0 tm:break-words tm:whitespace-pre-wrap">
      {preview(text, limit)}
    </p>
  )
}

export function CodeBlock({ text, limit }: { text: string; limit?: number }) {
  return (
    <pre className="tm:overflow-hidden tm:rounded-md tm:bg-code tm:p-2">
      {limit ? preview(text, limit) : text}
    </pre>
  )
}
