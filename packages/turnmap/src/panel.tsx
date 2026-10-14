import { X } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "./cn"
import type { MessageGroupData, PartNode } from "./graph"
import { describeNode } from "./nodes/describe"
import { CodeBlock } from "./nodes/blocks"
import { stringify, truncateJson } from "./parse"
import { Badge, type BadgeTone } from "./ui/badge"
import { IconButton } from "./ui/button"
import { JsonDialog } from "./ui/json-dialog"

export type PanelSide = "left" | "right"

export function Section({
  title,
  json,
  children,
}: {
  title: string
  /** Full text for the expand dialog; shows the expand button when set. */
  json?: string
  children: ReactNode
}) {
  return (
    <section className="tm:flex tm:flex-col tm:gap-1.5">
      <div className="tm:flex tm:items-center tm:justify-between tm:gap-2">
        <h4 className="tm:m-0 tm:text-[11px] tm:font-semibold tm:tracking-wide tm:text-muted-foreground tm:uppercase">
          {title}
        </h4>
        {json != null && <JsonDialog title={title} text={json} />}
      </div>
      {children}
    </section>
  )
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== "")
  if (shown.length === 0) return null
  return (
    <dl className="tm:m-0 tm:grid tm:grid-cols-[auto_1fr] tm:gap-x-3 tm:gap-y-1 tm:text-[12px]">
      {shown.map(([k, v]) => (
        <div key={k} className="tm:contents">
          <dt className="tm:text-muted-foreground">{k}</dt>
          <dd className="tm:m-0 tm:min-w-0 tm:break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Text({ text }: { text: string }) {
  return text.trim() ? (
    <p className="tm:m-0 tm:whitespace-pre-wrap tm:text-[13px]">{text}</p>
  ) : (
    <p className="tm:m-0 tm:text-muted-foreground tm:italic">(empty)</p>
  )
}

const OUTCOME_TONE: Record<string, BadgeTone> = {
  success: "success",
  return: "success",
  failed: "danger",
  retry: "danger",
  denied: "warning",
  interrupted: "warning",
}

const FINISH_TONE: Record<string, BadgeTone> = {
  stop: "success",
  tool_call: "info",
  length: "warning",
  content_filter: "warning",
  error: "danger",
}

function usageRows(usage: MessageGroupData["usage"]): [string, ReactNode][] {
  if (!usage) return []
  return [
    ["input tokens", usage.input_tokens?.toLocaleString()],
    ["output tokens", usage.output_tokens?.toLocaleString()],
    [
      "cache read",
      usage.cache_read_tokens ? usage.cache_read_tokens.toLocaleString() : null,
    ],
    [
      "cache write",
      usage.cache_write_tokens
        ? usage.cache_write_tokens.toLocaleString()
        : null,
    ],
    ["cost", usage.cost != null ? String(usage.cost) : null],
  ]
}

/**
 * Side panel overlaying the canvas with a node's full content and metadata.
 * Rendered inside the `.turnmap` root; `side` is chosen by the caller so the
 * panel does not cover the node it describes.
 */
export function SidePanel({
  node,
  group,
  side,
  index,
  total,
  onClose,
}: {
  node: PartNode
  group: MessageGroupData | undefined
  side: PanelSide
  index: number
  total: number
  onClose: () => void
}) {
  const { title, content } = describeNode(node)
  const d = node.data as Record<string, unknown>
  const partRows: [string, ReactNode][] = [
    ["part", <Badge key="kind">{node.data.partKind}</Badge>],
    ["position", `${index + 1} of ${total}`],
    [
      "message",
      group
        ? `${group.kind === "request" ? "Request" : "Response"} ${group.ordinal}`
        : null,
    ],
    [
      "timestamp",
      node.data.timestamp
        ? String(node.data.timestamp)
        : (group?.timestamp ?? null),
    ],
    [
      "tool call id",
      typeof d.toolCallId === "string" ? (
        <code className="tm:text-[11px]">{d.toolCallId}</code>
      ) : null,
    ],
    [
      "tool kind",
      typeof d.toolKind === "string" ? <Badge>{d.toolKind}</Badge> : null,
    ],
    [
      "outcome",
      typeof d.outcome === "string" ? (
        <Badge tone={OUTCOME_TONE[d.outcome] ?? "neutral"}>{d.outcome}</Badge>
      ) : null,
    ],
    [
      "provider",
      typeof d.providerName === "string" ? (
        <Badge tone="info">{d.providerName}</Badge>
      ) : null,
    ],
  ]
  const messageRows: [string, ReactNode][] = group
    ? [
        ["model", group.modelName],
        ["provider", group.providerName],
        [
          "finish reason",
          group.finishReason ? (
            <Badge tone={FINISH_TONE[group.finishReason] ?? "neutral"}>
              {group.finishReason}
            </Badge>
          ) : null,
        ],
        [
          "state",
          group.state && group.state !== "complete" ? (
            <Badge tone="warning">{group.state}</Badge>
          ) : null,
        ],
        ["run id", group.runId],
        ...usageRows(group.usage),
      ]
    : []
  return (
    <aside
      className={cn(
        "tm-panel tm:absolute tm:top-0 tm:bottom-0 tm:z-20 tm:flex tm:w-[min(420px,92%)] tm:flex-col tm:border-border tm:bg-card tm:text-foreground tm:shadow-2xl",
        side === "right" ? "tm:right-0 tm:border-l" : "tm:left-0 tm:border-r"
      )}
      role="dialog"
      aria-label={title}
    >
      <header className="tm:flex tm:shrink-0 tm:items-start tm:justify-between tm:gap-2 tm:border-b tm:border-border tm:px-4 tm:py-3">
        <div className="tm:min-w-0">
          <div className="tm:truncate tm:text-sm tm:font-semibold">{title}</div>
          <div className="tm:text-[11px] tm:text-muted-foreground">
            {group
              ? `${group.kind === "request" ? "Request" : "Response"} ${group.ordinal} · `
              : ""}
            node {index + 1} of {total}
          </div>
        </div>
        <IconButton aria-label="Close panel" onClick={onClose}>
          <X className="tm:h-4 tm:w-4" />
        </IconButton>
      </header>
      <div className="tm:flex tm:min-h-0 tm:flex-1 tm:flex-col tm:gap-5 tm:overflow-auto tm:px-4 tm:py-4">
        {content}
        <Section title="Part">
          <Rows rows={partRows} />
        </Section>
        {messageRows.some(([, v]) => v != null) && (
          <Section title="Message">
            <Rows rows={messageRows} />
          </Section>
        )}
        {group?.instructions && (
          <Section title="Instructions">
            <Text text={group.instructions} />
          </Section>
        )}
        <Section title="Raw part" json={stringify(node.data.raw)}>
          <CodeBlock
            text={stringify(truncateJson(node.data.raw))}
            limit={Infinity}
          />
        </Section>
      </div>
    </aside>
  )
}
