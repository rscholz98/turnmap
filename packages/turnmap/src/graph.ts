import type { Edge, Node } from "@xyflow/react"

import { ACCENTS } from "./accents"
import { contentToText, parseToolArgs } from "./parse"
import type {
  BinaryContent,
  ErrorDetails,
  FinishReason,
  MessageKind,
  MessageState,
  ModelMessage,
  ModelPart,
  RequestUsage,
  ToolReturnOutcome,
  UserContentItem,
} from "./schema"

// =============================================================================
// Node data
// =============================================================================

interface PartNodeBase {
  messageIndex: number
  partIndex: number
  partKind: string
  timestamp?: string | null
  /** The original part, for the expand dialog and consumers. */
  raw: ModelPart
  [key: string]: unknown
}

export interface PromptNodeData extends PartNodeBase {
  role: "system" | "user"
  text: string
  /** Non-text user content items (images, files, cache points). */
  attachments: Exclude<UserContentItem, string>[]
  dynamicRef?: string | null
}

export interface ResponseNodeData extends PartNodeBase {
  text: string
}

export interface ThinkingNodeData extends PartNodeBase {
  variant: "thinking" | "compaction"
  text: string
  signature?: string | null
}

export interface ToolCallNodeData extends PartNodeBase {
  toolName: string
  toolCallId: string
  toolKind?: string | null
  args: unknown
  rawArgs: unknown
  builtin: boolean
  providerName?: string | null
  /** Whether a return or retry part answers this call anywhere in the history. */
  answered: boolean
  outcome?: ToolReturnOutcome | "retry" | null
}

export interface ToolReturnNodeData extends PartNodeBase {
  toolName: string
  toolCallId: string
  toolKind?: string | null
  content: unknown
  outcome?: ToolReturnOutcome | null
  builtin: boolean
  providerName?: string | null
  metadata?: unknown
  /** False when no tool-call with this id exists in the history. */
  linked: boolean
}

export interface RetryNodeData extends PartNodeBase {
  errors: ErrorDetails[] | null
  text: string | null
  toolName: string | null
  toolCallId: string
  linked: boolean
}

export interface MediaNodeData extends PartNodeBase {
  variant: "file" | "speech"
  mediaType?: string | null
  /** base64 payload length, as a rough size indicator */
  byteLength?: number
  dataUrl?: string | null
  transcript?: string | null
  speaker?: "user" | "assistant" | null
  interruptedAtMs?: number | null
}

export interface NoteNodeData extends PartNodeBase {
  title: string
  lines: string[]
}

export interface UnknownNodeData extends PartNodeBase {
  title: string
}

export interface MessageGroupData {
  kind: MessageKind
  messageIndex: number
  /** 1-based ordinal among messages of the same kind */
  ordinal: number
  partIds: string[]
  timestamp?: string | null
  state?: MessageState | null
  runId?: string | null
  instructions?: string | null
  modelName?: string | null
  providerName?: string | null
  finishReason?: FinishReason | null
  usage?: RequestUsage | null
  [key: string]: unknown
}

export type PromptNode = Node<PromptNodeData, "prompt">
export type ResponseNode = Node<ResponseNodeData, "response">
export type ThinkingNode = Node<ThinkingNodeData, "thinking">
export type ToolCallNode = Node<ToolCallNodeData, "toolCall">
export type ToolReturnNode = Node<ToolReturnNodeData, "toolReturn">
export type RetryNode = Node<RetryNodeData, "retry">
export type MediaNode = Node<MediaNodeData, "media">
export type NoteNode = Node<NoteNodeData, "note">
export type UnknownNode = Node<UnknownNodeData, "unknown">
export type MessageGroupNode = Node<MessageGroupData, "messageGroup">

export type PartNode =
  | PromptNode
  | ResponseNode
  | ThinkingNode
  | ToolCallNode
  | ToolReturnNode
  | RetryNode
  | MediaNode
  | NoteNode
  | UnknownNode

export type TurnMapNode = PartNode | MessageGroupNode

export type EdgeKind = "flow" | "call" | "return" | "retry"

export interface TurnMapEdgeData {
  kind: EdgeKind
  [key: string]: unknown
}

export type TurnMapEdge = Edge<TurnMapEdgeData>

export interface TurnMapGraph {
  nodes: PartNode[]
  edges: TurnMapEdge[]
  /** One entry per message, in order; attached as group nodes after layout. */
  groups: MessageGroupData[]
}

// =============================================================================
// Helpers
// =============================================================================

export function partNodeId(messageIndex: number, partIndex: number): string {
  return `m${messageIndex}p${partIndex}`
}

export function groupNodeId(messageIndex: number): string {
  return `m${messageIndex}`
}

function edgeId(source: string, target: string): string {
  return `e:${source}:${target}`
}

function makeEdge(source: string, target: string, kind: EdgeKind): TurnMapEdge {
  const base: TurnMapEdge = {
    id: edgeId(source, target),
    source,
    target,
    data: { kind },
  }
  switch (kind) {
    case "flow":
      return { ...base, style: { stroke: ACCENTS.flow, strokeWidth: 1.5 } }
    case "call":
      return {
        ...base,
        animated: true,
        style: { stroke: ACCENTS.toolCall, strokeWidth: 1.5 },
      }
    case "return":
      return {
        ...base,
        style: { stroke: ACCENTS.toolReturn, strokeWidth: 1.5 },
      }
    case "retry":
      return {
        ...base,
        animated: true,
        style: {
          stroke: ACCENTS.retry,
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
        },
      }
  }
}

function binaryInfo(content: BinaryContent | null | undefined) {
  if (!content || typeof content !== "object") return {}
  const data = typeof content.data === "string" ? content.data : ""
  const mediaType = content.media_type ?? null
  const byteLength = Math.floor((data.length * 3) / 4)
  const inlineable =
    mediaType != null &&
    (mediaType.startsWith("image/") || mediaType.startsWith("audio/")) &&
    data.length < 2_000_000
  return {
    mediaType,
    byteLength,
    dataUrl: inlineable ? `data:${mediaType};base64,${data}` : null,
  }
}

// =============================================================================
// Builder
// =============================================================================

/**
 * Turn a message history into React Flow nodes and edges (no positions yet;
 * see `layoutGraph`).
 *
 * One node per part. Inside a message, non-tool parts chain in order; each
 * tool call branches from the current chain tip so parallel calls sit side by
 * side; a tool return or retry hangs off the call it answers (matched by
 * `tool_call_id`) and otherwise joins the chain. A message's leaves (nodes
 * without an outgoing edge once the message ends) feed the next message, so
 * several returns converge on the following response.
 */
export function buildGraph(messages: ModelMessage[]): TurnMapGraph {
  const nodes: PartNode[] = []
  const edges: TurnMapEdge[] = []
  const groups: MessageGroupData[] = []

  // Pass 1: index every tool call and note which ids get an answer.
  const callNodeIdByCallId = new Map<string, string>()
  const answerByCallId = new Map<string, ToolReturnOutcome | "retry">()
  messages.forEach((message, mi) => {
    message.parts.forEach((part, pi) => {
      const kind = part.part_kind
      if (kind === "tool-call" || kind === "builtin-tool-call") {
        const id = (part as { tool_call_id?: string }).tool_call_id
        if (id) callNodeIdByCallId.set(id, partNodeId(mi, pi))
      }
    })
  })
  messages.forEach((message) => {
    message.parts.forEach((part) => {
      const kind = part.part_kind
      const id = (part as { tool_call_id?: string }).tool_call_id
      if (!id) return
      if (kind === "tool-return" || kind === "builtin-tool-return") {
        answerByCallId.set(
          id,
          (part as { outcome?: ToolReturnOutcome | null }).outcome ?? "success"
        )
      } else if (kind === "retry-prompt" && !answerByCallId.has(id)) {
        answerByCallId.set(id, "retry")
      }
    })
  })

  const hasOutgoing = new Set<string>()
  // For each tool-call node, the chain tips it branched from. When its return
  // arrives, the return supersedes those tips so later parts follow the result
  // instead of the prompt that triggered the call.
  const branchedFrom = new Map<string, string[]>()
  const pushEdge = (source: string, target: string, kind: EdgeKind) => {
    if (source === target) return
    const id = edgeId(source, target)
    if (edges.some((e) => e.id === id)) return
    edges.push(makeEdge(source, target, kind))
    hasOutgoing.add(source)
  }

  let previousLeaves: string[] = []
  let requestOrdinal = 0
  let responseOrdinal = 0

  messages.forEach((message, mi) => {
    const partIds: string[] = []
    // Chain tips: where the next sequential part connects from.
    let tips: string[] = previousLeaves
    const memberIds: string[] = []

    message.parts.forEach((part, pi) => {
      const id = partNodeId(mi, pi)
      partIds.push(id)
      memberIds.push(id)
      const base = {
        messageIndex: mi,
        partIndex: pi,
        partKind: part.part_kind,
        timestamp: (part as { timestamp?: string | null }).timestamp ?? null,
        raw: part,
      }
      const kind = part.part_kind

      const chain = () => {
        tips.forEach((tip) => pushEdge(tip, id, "flow"))
        tips = [id]
      }

      // Attach this part under the call it answers and make it a tip in place
      // of that call (and of the tips the call branched from).
      const answer = (callNodeId: string, kind: EdgeKind) => {
        pushEdge(callNodeId, id, kind)
        const superseded = new Set([
          callNodeId,
          ...(branchedFrom.get(callNodeId) ?? []),
        ])
        tips = [...tips.filter((t) => !superseded.has(t)), id]
      }

      switch (kind) {
        case "system-prompt": {
          const p = part as Extract<ModelPart, { part_kind: "system-prompt" }>
          nodes.push({
            id,
            type: "prompt",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              role: "system",
              text: p.content ?? "",
              attachments: [],
              dynamicRef: p.dynamic_ref ?? null,
            },
          })
          chain()
          break
        }
        case "user-prompt": {
          const p = part as Extract<ModelPart, { part_kind: "user-prompt" }>
          const attachments = Array.isArray(p.content)
            ? (p.content.filter(
                (item) =>
                  typeof item !== "string" && item?.kind !== "text-content"
              ) as Exclude<UserContentItem, string>[])
            : []
          nodes.push({
            id,
            type: "prompt",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              role: "user",
              text: contentToText(p.content),
              attachments,
            },
          })
          chain()
          break
        }
        case "text": {
          const p = part as Extract<ModelPart, { part_kind: "text" }>
          nodes.push({
            id,
            type: "response",
            position: { x: 0, y: 0 },
            data: { ...base, text: p.content ?? "" },
          })
          chain()
          break
        }
        case "thinking":
        case "compaction": {
          const p = part as {
            content?: string | null
            signature?: string | null
          }
          nodes.push({
            id,
            type: "thinking",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              variant: kind,
              text: p.content ?? "",
              signature: p.signature ?? null,
            },
          })
          chain()
          break
        }
        case "tool-call":
        case "builtin-tool-call": {
          const p = part as Extract<ModelPart, { part_kind: "tool-call" }>
          const callId = p.tool_call_id ?? ""
          nodes.push({
            id,
            type: "toolCall",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              toolName: p.tool_name ?? "tool",
              toolCallId: callId,
              toolKind: p.tool_kind ?? null,
              args: parseToolArgs(p.args),
              rawArgs: p.args,
              builtin: kind === "builtin-tool-call",
              providerName: p.provider_name ?? null,
              answered: answerByCallId.has(callId),
              outcome: answerByCallId.get(callId) ?? null,
            },
          })
          // Branch from the tips; the tips stay so sibling calls fan out.
          tips.forEach((tip) => pushEdge(tip, id, "call"))
          branchedFrom.set(id, [...tips])
          break
        }
        case "tool-return":
        case "builtin-tool-return": {
          const p = part as Extract<ModelPart, { part_kind: "tool-return" }> & {
            provider_name?: string | null
          }
          const callId = p.tool_call_id ?? ""
          const callNodeId = callNodeIdByCallId.get(callId)
          nodes.push({
            id,
            type: "toolReturn",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              toolName: p.tool_name ?? "tool",
              toolCallId: callId,
              toolKind: p.tool_kind ?? null,
              content: p.content,
              outcome: p.outcome ?? null,
              builtin: kind === "builtin-tool-return",
              providerName: p.provider_name ?? null,
              metadata: p.metadata,
              linked: callNodeId != null,
            },
          })
          if (callNodeId) {
            answer(callNodeId, "return")
          } else {
            chain()
          }
          break
        }
        case "retry-prompt": {
          const p = part as Extract<ModelPart, { part_kind: "retry-prompt" }>
          const callId = p.tool_call_id ?? ""
          const callNodeId = p.tool_name
            ? callNodeIdByCallId.get(callId)
            : undefined
          nodes.push({
            id,
            type: "retry",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              errors: Array.isArray(p.content) ? p.content : null,
              text: typeof p.content === "string" ? p.content : null,
              toolName: p.tool_name ?? null,
              toolCallId: callId,
              linked: callNodeId != null,
            },
          })
          if (callNodeId) {
            answer(callNodeId, "retry")
          } else {
            tips.forEach((tip) => pushEdge(tip, id, "retry"))
            tips = [id]
          }
          break
        }
        case "file": {
          const p = part as Extract<ModelPart, { part_kind: "file" }>
          nodes.push({
            id,
            type: "media",
            position: { x: 0, y: 0 },
            data: { ...base, variant: "file", ...binaryInfo(p.content) },
          })
          chain()
          break
        }
        case "speech": {
          const p = part as Extract<ModelPart, { part_kind: "speech" }>
          nodes.push({
            id,
            type: "media",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              variant: "speech",
              ...binaryInfo(p.audio),
              transcript: p.transcript ?? null,
              speaker: p.speaker ?? null,
              interruptedAtMs: p.interrupted_at_ms ?? null,
            },
          })
          chain()
          break
        }
        case "tool-availability-delta": {
          const p = part as Extract<
            ModelPart,
            { part_kind: "tool-availability-delta" }
          >
          nodes.push({
            id,
            type: "note",
            position: { x: 0, y: 0 },
            data: {
              ...base,
              title: "Tools made available",
              lines: Array.isArray(p.tools_added) ? p.tools_added : [],
            },
          })
          chain()
          break
        }
        default: {
          nodes.push({
            id,
            type: "unknown",
            position: { x: 0, y: 0 },
            data: { ...base, title: kind },
          })
          chain()
        }
      }
    })

    // Leaves: members of this message without an outgoing edge. An empty
    // message passes the previous leaves through.
    const leaves = memberIds.filter((id) => !hasOutgoing.has(id))
    previousLeaves = leaves.length > 0 ? leaves : previousLeaves

    const ordinal =
      message.kind === "request" ? ++requestOrdinal : ++responseOrdinal
    groups.push({
      kind: message.kind,
      messageIndex: mi,
      ordinal,
      partIds,
      timestamp: message.timestamp ?? null,
      state: message.state ?? null,
      runId: message.run_id ?? null,
      instructions:
        message.kind === "request" ? (message.instructions ?? null) : null,
      modelName:
        message.kind === "response" ? (message.model_name ?? null) : null,
      providerName:
        message.kind === "response" ? (message.provider_name ?? null) : null,
      finishReason:
        message.kind === "response" ? (message.finish_reason ?? null) : null,
      usage: message.kind === "response" ? (message.usage ?? null) : null,
    })
  })

  return { nodes, edges, groups }
}
