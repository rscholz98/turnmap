/**
 * TypeScript mirror of the pydantic-ai message schema as it serializes through
 * `ModelMessagesTypeAdapter` / `all_messages_json()`: a JSON array of messages
 * discriminated by `kind`, each holding parts discriminated by `part_kind`.
 * The `Conversation` that wraps a history, and the entries and record a
 * `ConversationStore` keeps for one, are mirrored at the end.
 * Field names are the snake_case Python names, timestamps are ISO 8601
 * strings, bytes are base64 strings. Every field pydantic-ai may omit or set
 * to null is optional here, and extra fields are never rejected.
 */

export type MessageKind = "request" | "response"

export type FinishReason =
  "stop" | "length" | "content_filter" | "tool_call" | "error"

export type MessageState =
  "complete" | "incomplete" | "suspended" | "interrupted"

export type ToolReturnOutcome =
  "success" | "failed" | "denied" | "interrupted" | "retried"

/** Why a retry happened and how far into its budget it is. */
export interface RetryInfo {
  /**
   * For a retried tool call: `validation_error`, `model_retry`, `unknown_tool`
   * or `unavailable_tool`. For retry feedback: `validation_error`, `no_output`
   * or `model_retry`.
   */
  cause?: string | null
  attempt?: number | null
  max_retries?: number | null
}

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

/** A structured value in a user prompt, such as the state of the app the user sees. */
export interface StructuredContent {
  kind: "structured-content"
  value: unknown
  /** The value as it is rendered for the model. */
  content?: string
  tag?: string | null
  description?: string | null
  metadata?: unknown
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
  | StructuredContent
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
  context_id?: string | null
  scope?: "conversation" | "request" | null
  metadata?: Record<string, unknown> | null
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
  /** Set when `outcome` is `"retried"`: the call has to be made again. */
  retry?: RetryInfo | null
}

/**
 * The retry part of pydantic-ai before 2.60, still found in stored histories.
 * Newer versions record a `ToolReturnPart` with outcome `"retried"` for a
 * retry that answers a tool call, and a `RetryFeedbackPart` for one that
 * answers none.
 */
export interface RetryPromptPart {
  part_kind: "retry-prompt"
  content: string | ErrorDetails[]
  /** null for an output-validation retry (no tool involved) */
  tool_name?: string | null
  tool_call_id: string
  timestamp?: string | null
}

/** Feedback about a model response that could not be used as output. */
export interface RetryFeedbackPart {
  part_kind: "retry-feedback"
  content: string | ErrorDetails[]
  retry?: RetryInfo | null
  timestamp?: string | null
}

export interface ToolAvailabilityDeltaPart {
  part_kind: "tool-availability-delta"
  tools_added: string[]
  tool_call_id?: string | null
}

/** On-demand capabilities loaded at this point without a `load_capability` call. */
export interface CapabilityLoadDeltaPart {
  part_kind: "capability-load-delta"
  loaded: string[]
  tool_call_id?: string | null
}

/** Model settings that change from this point onward (today: thinking effort). */
export interface ModelSettingsDeltaPart {
  part_kind: "model-settings-delta"
  settings: Record<string, unknown>
  top_level?: boolean
}

/** One instruction block replaced (or withdrawn, when `content` is null) from here on. */
export interface InstructionDeltaPart {
  part_kind: "instruction-delta"
  id?: string | null
  content: string | null
  base_hash?: string | null
}

/** An instruction block as an `InstructionBaselinePart` records it in full. */
export interface InstructionBlock {
  part_kind?: "instruction"
  content: string
  dynamic?: boolean
  on_change?: string
  name?: string | null
  id?: string | null
}

/** A rewrite-mode instruction block recorded by its hash only. */
export interface InstructionDigest {
  part_kind: "instruction-digest"
  id?: string | null
  dynamic?: boolean
  content_hash: string
}

/** The instructions a request was sent with, where a run of appended changes starts. */
export interface InstructionBaselinePart {
  part_kind: "instruction-baseline"
  instructions: (InstructionBlock | InstructionDigest)[]
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
  citations?: Record<string, unknown>[] | null
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
  | RetryFeedbackPart
  | ToolAvailabilityDeltaPart
  | CapabilityLoadDeltaPart
  | ModelSettingsDeltaPart
  | InstructionDeltaPart
  | InstructionBaselinePart
  | CompactionPart
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
  output_reasoning_tokens?: number
  cache_write_tokens?: number
  cache_write_1h_tokens?: number
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
  /** `provider:model` as the run named it. */
  model_id?: string | null
  timestamp?: string | null
  provider_name?: string | null
  provider_url?: string | null
  provider_details?: Record<string, unknown> | null
  provider_response_id?: string | null
  finish_reason?: FinishReason | null
  workspace_ref?: { provider?: string; id?: string } | null
}

export type ModelMessage = ModelRequest | ModelResponse

// ---------------------------------------------------------------------------
// Conversations (pydantic_ai/conversation.py, pydantic_ai/conversation_store.py)
// ---------------------------------------------------------------------------

/** `RunUsage`: a conversation's running total, including what no message records. */
export interface RunUsage extends RequestUsage {
  requests?: number
  tool_calls?: number
}

/** The tool calls a paused run is waiting on. */
export interface DeferredToolRequests {
  /** Calls that need a result from outside the run. */
  calls?: ToolCallPart[]
  /** Calls that need approval. */
  approvals?: ToolCallPart[]
  /** What each call was deferred with, keyed by `tool_call_id`. */
  metadata?: Record<string, Record<string, unknown>> | null
}

/**
 * A `Conversation` as `ConversationTypeAdapter` serializes it: the messages
 * plus what lives outside them.
 */
export interface Conversation {
  messages: ModelMessage[]
  usage?: RunUsage | null
  conversation_id?: string | null
  deferred_tool_requests?: DeferredToolRequests | null
  revision?: string | null
  new_message_index?: number | null
}

/** One message in a `ConversationStore`'s log, linked to the entry before it. */
export interface ConversationEntry {
  id: string
  parent_id?: string | null
  message: ModelMessage
  /** `"message"` today; other kinds may join the log later. */
  kind?: string
}

/** What a `ConversationStore` keeps for a conversation besides its log. */
export interface ConversationRecord {
  conversation_id: string
  head_id?: string | null
  usage?: RunUsage | null
  deferred_tool_requests?: DeferredToolRequests | null
  scope?: string | null
  forked_from?: string | null
  forked_at?: string | null
  /** The last entries of the branches the conversation has left, oldest first. */
  branches?: string[]
  revision?: string | null
  updated_at?: string | null
  format_version?: number
}

export const REQUEST_PART_KINDS = new Set<string>([
  "system-prompt",
  "user-prompt",
  "tool-return",
  "retry-prompt",
  "retry-feedback",
  "tool-availability-delta",
  "capability-load-delta",
  "model-settings-delta",
  "instruction-delta",
  "instruction-baseline",
  "compaction",
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
