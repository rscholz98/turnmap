import type { NodeProps } from "@xyflow/react"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

import type { MessageGroupNode } from "../graph"
import { formatTime } from "./format"

function tokens(n: number | undefined) {
  return n == null ? null : n.toLocaleString()
}

/** Translucent box behind each message's parts with a slim metadata header. */
export function MessageGroupView({
  data,
  width,
  height,
}: NodeProps<MessageGroupNode>) {
  const isResponse = data.kind === "response"
  const time = formatTime(data.timestamp)
  const usage = data.usage ?? undefined
  const meta = [
    data.modelName,
    data.finishReason,
    data.state && data.state !== "complete" ? data.state : null,
    usage && (usage.input_tokens != null || usage.output_tokens != null)
      ? `${tokens(usage.input_tokens)} in · ${tokens(usage.output_tokens)} out`
      : null,
    data.instructions ? "instructions" : null,
  ].filter(Boolean)
  return (
    <div
      className="tm:flex tm:flex-col tm:rounded-lg tm:border tm:border-dashed tm:border-group-border tm:bg-group"
      style={{ width, height }}
    >
      <div
        className="tm:flex tm:items-center tm:gap-1.5 tm:overflow-hidden tm:px-2 tm:text-[10px] tm:whitespace-nowrap tm:text-muted-foreground"
        style={{ height: 22 }}
        title={data.instructions ?? undefined}
      >
        {isResponse ? (
          <ArrowDownToLine className="tm:h-2.5 tm:w-2.5 tm:shrink-0" />
        ) : (
          <ArrowUpFromLine className="tm:h-2.5 tm:w-2.5 tm:shrink-0" />
        )}
        <span className="tm:font-semibold tm:text-foreground">
          {isResponse ? "Response" : "Request"} {data.ordinal}
        </span>
        {meta.length > 0 && (
          <span className="tm:truncate">{meta.join(" · ")}</span>
        )}
        {time && <span className="tm:ml-auto tm:shrink-0">{time}</span>}
      </div>
    </div>
  )
}
