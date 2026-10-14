import type { NodeProps } from "@xyflow/react"
import {
  AlertTriangle,
  Bot,
  Brain,
  Cog,
  FileQuestion,
  Globe,
  Image as ImageIcon,
  Info,
  Layers,
  Mic,
  Paperclip,
  Undo2,
  User,
  Wrench,
} from "lucide-react"

import { ACCENTS } from "../accents"
import { useTurnMapSettings } from "../context"
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
import { stringify } from "../parse"
import type { ToolReturnOutcome, UserContentItem } from "../schema"
import { Badge, type BadgeTone } from "../ui/badge"
import { CollapsibleBlock } from "../ui/collapsible"
import { CodeBlock, TextBlock } from "./blocks"
import { formatBytes, formatTime } from "./format"
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

function RawJson({ value }: { value: unknown }) {
  return <CodeBlock text={stringify(value)} limit={Infinity} />
}

function Attachment({ item }: { item: Exclude<UserContentItem, string> }) {
  switch (item.kind) {
    case "image-url":
    case "audio-url":
    case "video-url":
    case "document-url":
      return (
        <a
          className="nodrag tm:inline-flex tm:max-w-full tm:items-center tm:gap-1 tm:rounded-md tm:bg-muted tm:px-1.5 tm:py-0.5 tm:text-[11px] tm:text-foreground tm:no-underline tm:hover:underline"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          title={item.url}
        >
          <Globe className="tm:h-3 tm:w-3 tm:shrink-0" />
          <span className="tm:truncate">
            {item.kind.replace("-url", "")}: {item.url}
          </span>
        </a>
      )
    case "binary": {
      const bytes = Math.floor(((item.data?.length ?? 0) * 3) / 4)
      const isImage = item.media_type?.startsWith("image/")
      return (
        <span className="tm:inline-flex tm:max-w-full tm:items-center tm:gap-1 tm:rounded-md tm:bg-muted tm:px-1.5 tm:py-0.5 tm:text-[11px]">
          {isImage ? (
            <ImageIcon className="tm:h-3 tm:w-3 tm:shrink-0" />
          ) : (
            <Paperclip className="tm:h-3 tm:w-3 tm:shrink-0" />
          )}
          <span className="tm:truncate">
            {item.media_type} · {formatBytes(bytes)}
          </span>
        </span>
      )
    }
    case "uploaded-file":
      return (
        <span className="tm:inline-flex tm:items-center tm:gap-1 tm:rounded-md tm:bg-muted tm:px-1.5 tm:py-0.5 tm:text-[11px]">
          <Paperclip className="tm:h-3 tm:w-3" /> uploaded file {item.file_id}
        </span>
      )
    case "cache-point":
      return (
        <span className="tm:inline-flex tm:items-center tm:gap-1 tm:rounded-md tm:bg-muted tm:px-1.5 tm:py-0.5 tm:text-[11px]">
          <Layers className="tm:h-3 tm:w-3" /> cache point
          {item.ttl ? ` (${item.ttl})` : ""}
        </span>
      )
    default:
      return <RawJson value={item} />
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
      footer={formatTime(data.timestamp)}
    >
      <TextBlock text={data.text} limit={400} />
      {attachments > 0 && (
        <div className="tm:flex tm:flex-wrap tm:gap-1">
          {data.attachments.map((item, i) => (
            <Attachment key={i} item={item} />
          ))}
        </div>
      )}
    </NodeShell>
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
    >
      <TextBlock text={data.text} limit={400} />
    </NodeShell>
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
    >
      <TextBlock text={data.text} limit={400} />
    </NodeShell>
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
  const argsText = data.args == null ? "" : stringify(data.args)
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
      footer={<span className="tm:truncate">id {data.toolCallId}</span>}
    >
      {argsText ? (
        <CodeBlock text={argsText} limit={500} />
      ) : (
        <p className="tm:m-0 tm:text-muted-foreground tm:italic">
          no arguments
        </p>
      )}
    </NodeShell>
  )
}

export function ToolReturnNodeView({ id, data }: NodeProps<ToolReturnNode>) {
  const { collapseThreshold } = useTurnMapSettings()
  const text = stringify(data.content)
  const large = text.length > collapseThreshold
  const accent = data.builtin ? ACCENTS.builtinTool : ACCENTS.toolReturn
  const time = formatTime(data.timestamp)
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
      footer={
        <>
          {time && <span>{time}</span>}
          <span className="tm:truncate">id {data.toolCallId}</span>
          <span>{formatBytes(text.length)}</span>
        </>
      }
    >
      {large ? (
        <CollapsibleBlock
          label={`output · ${formatBytes(text.length)}`}
          defaultOpen={false}
        >
          <CodeBlock text={text} limit={600} />
        </CollapsibleBlock>
      ) : (
        <CodeBlock text={text} limit={600} />
      )}
    </NodeShell>
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
      footer={<span className="tm:truncate">id {data.toolCallId}</span>}
    >
      {data.errors ? (
        <ul className="tm:m-0 tm:flex tm:list-none tm:flex-col tm:gap-1.5 tm:p-0">
          {data.errors.slice(0, 5).map((err, i) => (
            <li
              key={i}
              className="tm:rounded-md tm:bg-accent-retry/10 tm:px-2 tm:py-1"
            >
              <div className="tm:font-mono tm:text-[11px] tm:text-accent-retry">
                {err.loc?.length ? err.loc.join(".") : "(root)"} · {err.type}
              </div>
              <div className="tm:text-[12px]">{err.msg}</div>
            </li>
          ))}
          {data.errors.length > 5 && (
            <li className="tm:text-[11px] tm:text-muted-foreground">
              and {data.errors.length - 5} more
            </li>
          )}
        </ul>
      ) : (
        <TextBlock text={data.text ?? ""} />
      )}
    </NodeShell>
  )
}

export function MediaNodeView({ id, data }: NodeProps<MediaNode>) {
  const isSpeech = data.variant === "speech"
  const isImage = data.mediaType?.startsWith("image/") && data.dataUrl
  const isAudio = data.mediaType?.startsWith("audio/") && data.dataUrl
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
    >
      {isImage && (
        <img
          src={data.dataUrl!}
          alt=""
          className="tm:max-h-40 tm:w-full tm:rounded-md tm:object-contain"
        />
      )}
      {isAudio && (
        <audio controls src={data.dataUrl!} className="nodrag tm:w-full" />
      )}
      {data.transcript && <TextBlock text={data.transcript} limit={300} />}
      {!isImage && !isAudio && !data.transcript && (
        <p className="tm:m-0 tm:text-muted-foreground">
          {data.mediaType ?? "binary"}
        </p>
      )}
    </NodeShell>
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
    >
      {data.lines.length > 0 ? (
        <ul className="tm:m-0 tm:list-disc tm:pl-4">
          {data.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </NodeShell>
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
    >
      <CodeBlock text={stringify(data.raw)} limit={400} />
    </NodeShell>
  )
}
