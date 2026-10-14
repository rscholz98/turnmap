import type { NodeProps } from "@xyflow/react"
import {
  AlertTriangle,
  Bot,
  Brain,
  Cog,
  FileQuestion,
  Globe,
  Info,
  Layers,
  Mic,
  Paperclip,
  Undo2,
  User,
  Wrench,
} from "lucide-react"

import { ACCENTS } from "../accents"
import type {
  MediaNode,
  NoteNode,
  PromptNode,
  ResponseNode,
  RetryNode,
  ThinkingNode,
  ToolCallNode,
  ToolReturnNode,
  UnknownNode,
} from "../graph"
import type { ToolReturnOutcome } from "../schema"
import { Badge, type BadgeTone } from "../ui/badge"
import { formatBytes } from "./format"
import { NodeShell } from "./shell"

const ICON = "tm:h-3.5 tm:w-3.5"

/** Single-line rendering for the header summary. */
function oneLine(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

// ---------------------------------------------------------------------------

export function PromptNodeView({ id, data }: NodeProps<PromptNode>) {
  const isUser = data.role === "user"
  const accent = isUser ? ACCENTS.user : ACCENTS.system
  const attachments = data.attachments.length
  return (
    <NodeShell
      nodeId={id}
      accent={accent}
      icon={isUser ? <User className={ICON} /> : <Cog className={ICON} />}
      title={isUser ? "User prompt" : "System prompt"}
      summary={
        oneLine(data.text) ||
        (attachments ? `${attachments} attachment(s)` : "(empty)")
      }
      badges={
        <>
          {attachments > 0 && (
            <Badge tone="info">
              {attachments} file{attachments === 1 ? "" : "s"}
            </Badge>
          )}
          {data.dynamicRef && <Badge>dynamic</Badge>}
        </>
      }
    />
  )
}

export function ResponseNodeView({ id, data }: NodeProps<ResponseNode>) {
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.response}
      icon={<Bot className={ICON} />}
      title="Model response"
      summary={oneLine(data.text) || "(empty)"}
    />
  )
}

export function ThinkingNodeView({ id, data }: NodeProps<ThinkingNode>) {
  const compaction = data.variant === "compaction"
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.thinking}
      icon={
        compaction ? <Layers className={ICON} /> : <Brain className={ICON} />
      }
      title={compaction ? "Compaction" : "Thinking"}
      summary={oneLine(data.text) || `${data.text.length} chars`}
      badges={data.signature ? <Badge>signed</Badge> : undefined}
    />
  )
}

const OUTCOME_TONE: Record<ToolReturnOutcome | "retry", BadgeTone> = {
  success: "success",
  failed: "danger",
  denied: "warning",
  interrupted: "warning",
  retry: "danger",
}

export function ToolCallNodeView({ id, data }: NodeProps<ToolCallNode>) {
  const accent = data.builtin ? ACCENTS.builtinTool : ACCENTS.toolCall
  return (
    <NodeShell
      nodeId={id}
      accent={accent}
      icon={
        data.builtin ? <Globe className={ICON} /> : <Wrench className={ICON} />
      }
      title={data.toolName}
      summary={data.args == null ? "no arguments" : oneLine(data.args)}
      badges={
        <>
          {data.builtin && (
            <Badge tone="info">{data.providerName ?? "builtin"}</Badge>
          )}
          {data.toolKind && <Badge>{data.toolKind}</Badge>}
          {data.outcome ? (
            <Badge tone={OUTCOME_TONE[data.outcome]}>{data.outcome}</Badge>
          ) : (
            <Badge tone="warning">no return</Badge>
          )}
        </>
      }
    />
  )
}

export function ToolReturnNodeView({ id, data }: NodeProps<ToolReturnNode>) {
  const accent = data.builtin ? ACCENTS.builtinTool : ACCENTS.toolReturn
  return (
    <NodeShell
      nodeId={id}
      accent={accent}
      icon={<Undo2 className={ICON} />}
      title={data.toolName}
      summary={oneLine(data.content) || "(empty)"}
      badges={
        <>
          {!data.linked && <Badge tone="warning">unmatched</Badge>}
          {data.outcome && data.outcome !== "success" ? (
            <Badge tone={OUTCOME_TONE[data.outcome]}>{data.outcome}</Badge>
          ) : (
            <Badge tone="success">return</Badge>
          )}
        </>
      }
    />
  )
}

export function RetryNodeView({ id, data }: NodeProps<RetryNode>) {
  const outputValidation = data.toolName == null
  const first = data.errors?.[0]
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.retry}
      icon={<AlertTriangle className={ICON} />}
      title={
        outputValidation
          ? "Retry: output validation"
          : `Retry: ${data.toolName}`
      }
      summary={
        first
          ? `${first.loc?.length ? first.loc.join(".") + ": " : ""}${first.msg}`
          : oneLine(data.text)
      }
      badges={
        <>
          <Badge tone="danger">
            {data.errors
              ? `${data.errors.length} error${data.errors.length === 1 ? "" : "s"}`
              : "retry"}
          </Badge>
          {!outputValidation && !data.linked && (
            <Badge tone="warning">unmatched</Badge>
          )}
        </>
      }
    />
  )
}

export function MediaNodeView({ id, data }: NodeProps<MediaNode>) {
  const isSpeech = data.variant === "speech"
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.media}
      icon={
        isSpeech ? <Mic className={ICON} /> : <Paperclip className={ICON} />
      }
      title={isSpeech ? `Speech (${data.speaker ?? "unknown"})` : "File"}
      summary={
        data.transcript
          ? oneLine(data.transcript)
          : [
              data.mediaType,
              data.byteLength != null ? formatBytes(data.byteLength) : null,
            ]
              .filter(Boolean)
              .join(" · ")
      }
      badges={
        data.interruptedAtMs != null ? (
          <Badge tone="warning">interrupted</Badge>
        ) : undefined
      }
    />
  )
}

export function NoteNodeView({ id, data }: NodeProps<NoteNode>) {
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.note}
      icon={<Info className={ICON} />}
      title={data.title}
      summary={data.lines.join(", ")}
    />
  )
}

export function UnknownNodeView({ id, data }: NodeProps<UnknownNode>) {
  return (
    <NodeShell
      nodeId={id}
      accent={ACCENTS.unknown}
      icon={<FileQuestion className={ICON} />}
      title={data.title}
      summary="unknown part kind"
    />
  )
}
