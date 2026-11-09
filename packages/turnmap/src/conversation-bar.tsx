import { GitBranch, MessagesSquare } from "lucide-react"

import type { ConversationBranch, ConversationInfo } from "./parse"
import { Badge } from "./ui/badge"

function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`
}

/** One line for a conversation's running usage, skipping what it does not record. */
function usageSummary(usage: ConversationInfo["usage"]): string | null {
  if (!usage) return null
  const parts = [
    usage.requests != null ? count(usage.requests, "request") : null,
    usage.tool_calls ? count(usage.tool_calls, "tool call") : null,
    usage.input_tokens != null || usage.output_tokens != null
      ? `${(usage.input_tokens ?? 0).toLocaleString()} in · ${(usage.output_tokens ?? 0).toLocaleString()} out`
      : null,
    usage.cost != null ? `cost ${usage.cost}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}

/** What a paused conversation is waiting on, for example "1 approval, 2 external results". */
function pendingSummary(
  requests: ConversationInfo["deferredToolRequests"]
): string | null {
  const approvals = requests?.approvals?.length ?? 0
  const calls = requests?.calls?.length ?? 0
  const parts = [
    approvals ? count(approvals, "approval") : null,
    calls ? count(calls, "external result") : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : null
}

/**
 * What a conversation carries besides its messages, shown in the canvas
 * corner: its id, running usage, what a paused run is waiting on, and a
 * switch between the current history and the branches a store kept.
 */
export function ConversationBar({
  conversation,
  messageCount,
  branches,
  selectedTip,
  onSelectBranch,
}: {
  conversation: ConversationInfo | undefined
  /** Messages in the current history (not the selected branch). */
  messageCount: number
  branches: ConversationBranch[]
  /** Tip of the branch shown, or `null` for the current history. */
  selectedTip: string | null
  onSelectBranch: (tipId: string | null) => void
}) {
  const usage = usageSummary(conversation?.usage)
  const pending = pendingSummary(conversation?.deferredToolRequests)
  const id = conversation?.conversationId
  if (!id && !usage && !pending && branches.length === 0) return null
  return (
    <div
      className="tm-conversation tm:flex tm:w-fit tm:max-w-[min(26rem,70vw)] tm:flex-col tm:items-start tm:gap-1 tm:rounded-lg tm:border tm:border-border tm:bg-card tm:px-2 tm:py-1 tm:text-[11px] tm:text-muted-foreground tm:shadow-sm"
      role="group"
      aria-label="Conversation"
    >
      <div className="tm:flex tm:max-w-full tm:flex-wrap tm:items-center tm:gap-x-2 tm:gap-y-1">
        <span className="tm:flex tm:min-w-0 tm:items-center tm:gap-1 tm:font-semibold tm:text-foreground">
          <MessagesSquare className="tm:h-3.5 tm:w-3.5 tm:shrink-0" />
          <span className="tm:truncate" title={id ?? undefined}>
            {id ?? "Conversation"}
          </span>
        </span>
        {conversation?.scope && (
          <Badge title="The scope the conversation was saved with">
            {conversation.scope}
          </Badge>
        )}
        {conversation?.forkedFrom && (
          <Badge tone="info" title="The conversation this one was forked from">
            fork of {conversation.forkedFrom}
          </Badge>
        )}
        {usage && <span className="tm:tabular-nums">{usage}</span>}
      </div>
      {pending && <Badge tone="warning">paused: {pending}</Badge>}
      {branches.length > 0 && (
        <label className="tm:flex tm:max-w-full tm:items-center tm:gap-1">
          <GitBranch className="tm:h-3 tm:w-3 tm:shrink-0" />
          <select
            aria-label="Branch"
            className="tm:h-6 tm:max-w-full tm:min-w-0 tm:cursor-pointer tm:rounded-md tm:border tm:border-border tm:bg-card tm:px-1 tm:text-[11px] tm:text-foreground"
            value={selectedTip ?? ""}
            onChange={(event) => onSelectBranch(event.target.value || null)}
          >
            <option value="">
              Current history · {count(messageCount, "message")}
            </option>
            {branches.map((branch, index) => (
              <option key={branch.tipId} value={branch.tipId}>
                Branch {index + 1} ·{" "}
                {branch.sharedCount > 0
                  ? `left after message ${branch.sharedCount}`
                  : "from the start"}{" "}
                · {count(branch.messages.length, "message")}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
