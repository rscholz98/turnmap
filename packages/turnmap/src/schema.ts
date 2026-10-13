/**
 * TypeScript mirror of the pydantic-ai message schema as it serializes through
 * `ModelMessagesTypeAdapter` / `all_messages_json()`: a JSON array of messages
 * discriminated by `kind`, each holding parts discriminated by `part_kind`.
 * Field names are the snake_case Python names, timestamps are ISO 8601
 * strings, bytes are base64 strings. Every field pydantic-ai may omit or set
 * to null is optional here, and extra fields are never rejected.
 */

export type MessageKind = "request" | "response"

export type FinishReason =
  "stop" | "length" | "content_filter" | "tool_call" | "error"

export type MessageState =
  "complete" | "incomplete" | "suspended" | "interrupted"

export type ToolReturnOutcome = "success" | "failed" | "denied" | "interrupted"

// ---------------------------------------------------------------------------
// User content (UserPromptPart.content items)
// ---------------------------------------------------------------------------

export interface TextContent {
  kind: "text-content"
  content: string
  metadata?: unknown
}

export interface FileUrlContent {
  kind: "image-url" | "audio-url" | "video-url" | "document-url"
  url: string
  force_download?: boolean
  vendor_metadata?: Record<string, unknown> | null
  media_type?: string | null
  identifier?: string | null
}

export interface BinaryContent {
  kind: "binary"
  /** base64 */
  data: string
  media_type: string
  vendor_metadata?: Record<string, unknown> | null
  identifier?: string | null
}

export interface UploadedFileContent {
  kind: "uploaded-file"
  file_id: string
  provider_name?: string | null
  [key: string]: unknown
}

export interface CachePointContent {
  kind: "cache-point"
  ttl?: "5m" | "1h" | null
}

export type UserContentItem =
  | string
  | TextContent
  | FileUrlContent
  | BinaryContent
  | UploadedFileContent
  | CachePointContent

export type UserContent = string | UserContentItem[]

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export interface ErrorDetails {
  type: string
  loc: (string | number)[]
  msg: string
  input?: unknown
  ctx?: Record<string, unknown>
  url?: string
}

interface ProviderFields {
  id?: string | null
  provider_name?: string | null
  provider_details?: Record<string, unknown> | null
}

export interface SystemPromptPart {
  part_kind: "system-prompt"
  content: string
  timestamp?: string | null
  dynamic_ref?: string | null
}

export interface UserPromptPart {
  part_kind: "user-prompt"
  content: UserContent
  timestamp?: string | null
}

export interface ToolReturnPart {
  part_kind: "tool-return"
  tool_name: string
  content: unknown
  tool_call_id: string
  tool_kind?: string | null
  metadata?: unknown
  timestamp?: string | null
  outcome?: ToolReturnOutcome | null
}

export interface RetryPromptPart {
  part_kind: "retry-prompt"
  content: string | ErrorDetails[]
  /** null for an output-validation retry (no tool involved) */
  tool_name?: string | null
  tool_call_id: string
  timestamp?: string | null
}

export interface ToolAvailabilityDeltaPart {
  part_kind: "tool-availability-delta"
  tools_added: string[]
  tool_call_id?: string | null
}

export interface SpeechPart extends ProviderFields {
  part_kind: "speech"
  speaker: "user" | "assistant"
  transcript?: string | null
  audio?: BinaryContent | null
  interrupted_at_ms?: number | null
}

export interface TextPart extends ProviderFields {
  part_kind: "text"
  content: string
}

export interface ToolCallPart extends ProviderFields {
  part_kind: "tool-call"
  tool_name: string
  /** JSON string, parsed object, or null */
  args: string | Record<string, unknown> | null
  tool_call_id: string
  tool_kind?: string | null
}

export interface BuiltinToolCallPart extends ProviderFields {
  part_kind: "builtin-tool-call"
  tool_name: string
  args: string | Record<string, unknown> | null
  tool_call_id: string
  tool_kind?: string | null
}

export interface BuiltinToolReturnPart extends ProviderFields {
  part_kind: "builtin-tool-return"
  tool_name: string
  content: unknown
  tool_call_id: string
  tool_kind?: string | null
  metadata?: unknown
  timestamp?: string | null
  outcome?: ToolReturnOutcome | null
}

export interface ThinkingPart extends ProviderFields {
  part_kind: "thinking"
  content: string
  signature?: string | null
}

export interface CompactionPart extends ProviderFields {
  part_kind: "compaction"
  content?: string | null
}

export interface FilePart extends ProviderFields {
  part_kind: "file"
  content: BinaryContent
}

/** A part whose `part_kind` this version does not know. Rendered as raw JSON. */
export interface UnknownPart {
  part_kind: string
  [key: string]: unknown
}

export type RequestPart =
  | SystemPromptPart
  | UserPromptPart
  | ToolReturnPart
  | RetryPromptPart
  | ToolAvailabilityDeltaPart
  | SpeechPart

export type ResponsePart =
  | TextPart
  | ToolCallPart
  | BuiltinToolCallPart
  | BuiltinToolReturnPart
  | ThinkingPart
  | CompactionPart
  | FilePart
  | SpeechPart

export type ModelPart = RequestPart | ResponsePart | UnknownPart

export type PartKind = (RequestPart | ResponsePart)["part_kind"]

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface RequestUsage {
  input_tokens?: number
  output_tokens?: number
  cache_write_tokens?: number
  cache_read_tokens?: number
  input_audio_tokens?: number
  cache_audio_read_tokens?: number
  output_audio_tokens?: number
  audio_seconds?: number
  details?: Record<string, number> | null
  /** Decimal serialized as a string */
  cost?: string | number | null
}

interface MessageCommon {
  run_id?: string | null
  conversation_id?: string | null
  metadata?: Record<string, unknown> | null
  state?: MessageState | null
}

export interface ModelRequest extends MessageCommon {
  kind: "request"
  parts: (RequestPart | UnknownPart)[]
  timestamp?: string | null
  instructions?: string | null
}

export interface ModelResponse extends MessageCommon {
  kind: "response"
  parts: (ResponsePart | UnknownPart)[]
  usage?: RequestUsage | null
  model_name?: string | null
  timestamp?: string | null
  provider_name?: string | null
  provider_url?: string | null
  provider_details?: Record<string, unknown> | null
  provider_response_id?: string | null
  finish_reason?: FinishReason | null
  workspace_ref?: { provider?: string; id?: string } | null
}

export type ModelMessage = ModelRequest | ModelResponse

export const REQUEST_PART_KINDS = new Set<string>([
  "system-prompt",
  "user-prompt",
  "tool-return",
  "retry-prompt",
  "tool-availability-delta",
  "speech",
])

export const RESPONSE_PART_KINDS = new Set<string>([
  "text",
  "tool-call",
  "builtin-tool-call",
  "builtin-tool-return",
  "thinking",
  "compaction",
  "file",
  "speech",
])

export function isKnownPartKind(kind: string): kind is PartKind {
  return REQUEST_PART_KINDS.has(kind) || RESPONSE_PART_KINDS.has(kind)
}
