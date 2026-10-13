import type { NodeProps } from "@xyflow/react"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

import type { MessageGroupNode } from "../graph"
import { Badge } from "../ui/badge"
import { formatTime } from "./format"

function tokens(n: number | undefined) {
  return n == null ? null : n.toLocaleString()
}

/** Translucent box behind each message's parts, with the message metadata. */
export function MessageGroupView({
  data,
  width,
  height,
}: NodeProps<MessageGroupNode>) {
  const isResponse = data.kind === "response"
  const time = formatTime(data.timestamp)
  const usage = data.usage ?? undefined
  return (
    <div
      className="tm:flex tm:flex-col tm:rounded-xl tm:border tm:border-dashed tm:border-group-border tm:bg-group"
      style={{ width, height }}
    >
      <div className="tm:flex tm:flex-wrap tm:items-center tm:gap-1.5 tm:px-3 tm:py-1.5 tm:text-[11px] tm:text-muted-foreground">
        {isResponse ? (
          <ArrowDownToLine className="tm:h-3 tm:w-3" />
        ) : (
          <ArrowUpFromLine className="tm:h-3 tm:w-3" />
        )}
        <span className="tm:font-semibold tm:text-foreground">
          {isResponse ? "ModelResponse" : "ModelRequest"} #{data.ordinal}
        </span>
        {data.modelName && <Badge>{data.modelName}</Badge>}
        {data.providerName && <Badge>{data.providerName}</Badge>}
        {data.finishReason && (
          <Badge
            tone={
              data.finishReason === "stop" || data.finishReason === "tool_call"
                ? "neutral"
                : "warning"
            }
          >
            {data.finishReason}
          </Badge>
        )}
        {data.state && data.state !== "complete" && (
          <Badge tone="warning">{data.state}</Badge>
        )}
        {usage &&
          (usage.input_tokens != null || usage.output_tokens != null) && (
            <span>
              {tokens(usage.input_tokens)} in · {tokens(usage.output_tokens)}{" "}
              out
              {usage.cache_read_tokens
                ? ` · ${tokens(usage.cache_read_tokens)} cached`
                : ""}
            </span>
          )}
        {data.instructions && (
          <Badge title={data.instructions}>instructions</Badge>
        )}
        {time && <span className="tm:ml-auto">{time}</span>}
      </div>
    </div>
  )
}
