import type {
  DeferredToolRequests,
  ModelMessage,
  ModelPart,
  RunUsage,
} from "./schema"
import { isKnownPartKind } from "./schema"

/**
 * What a `Conversation` (or a store's `ConversationRecord`) carries besides
 * its messages.
 */
export interface ConversationInfo {
  conversationId?: string | null
  /** Usage accumulated across every run in the conversation. */
  usage?: RunUsage | null
  /** The tool calls the conversation is waiting on, if its last run paused. */
  deferredToolRequests?: DeferredToolRequests | null
  revision?: string | null
  /** Whose conversation it is. Set from a store record only. */
  scope?: string | null
  /** The conversation a fork was made from. Set from a store record only. */
  forkedFrom?: string | null
  /** When it was last saved. Set from a store record only. */
  updatedAt?: string | null
}

/** A history a stored conversation has left: a regenerated or edited turn. */
export interface ConversationBranch {
  /** The branch's last entry, what `ConversationStore.branch(from_entry=...)` takes. */
  tipId: string
  /** The branch's whole history, from the first message. */
  messages: ModelMessage[]
  /** The store entry id of each message, aligned with `messages`. */
  entryIds: string[]
  /** How many leading messages the branch shares with the current history. */
  sharedCount: number
}

export interface ParseResult {
  messages: ModelMessage[]
  /** Non-fatal observations: unknown part kinds, skipped entries, etc. */
  warnings: string[]
  /** Set when the input was a `Conversation` or a stored conversation. */
  conversation?: ConversationInfo
  /** The store entry id of each message, when the input was store entries. */
  entryIds?: string[]
  /** The branches the conversation has left, when the input was store entries. */
  branches?: ConversationBranch[]
}

export class TurnMapParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TurnMapParseError"
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

const CONVERSATION_KEYS = [
  "usage",
  "conversation_id",
  "deferred_tool_requests",
  "revision",
] as const

/** The conversation-level fields of a `Conversation` or a `ConversationRecord`. */
function conversationInfo(
  source: Record<string, unknown>
): ConversationInfo | undefined {
  if (!CONVERSATION_KEYS.some((key) => source[key] != null)) return undefined
  return {
    conversationId: optionalString(source.conversation_id),
    usage: isObject(source.usage) ? (source.usage as RunUsage) : null,
    deferredToolRequests: isObject(source.deferred_tool_requests)
      ? (source.deferred_tool_requests as DeferredToolRequests)
      : null,
    revision: optionalString(source.revision),
    scope: optionalString(source.scope),
    forkedFrom: optionalString(source.forked_from),
    updatedAt: optionalString(source.updated_at),
  }
}

type EntryRow = Record<string, unknown> & { id: string }

/** `ConversationEntry` rows: every one has an `id` and names its `parent_id`. */
function isEntryRows(items: unknown[]): items is EntryRow[] {
  return (
    items.length > 0 &&
    items.every(
      (it) => isObject(it) && typeof it.id === "string" && "parent_id" in it
    )
  )
}

/** Validate one message and its parts; `null` (with a warning) if it is not one. */
function toMessage(
  item: unknown,
  index: number,
  warn: (warning: string) => void
): ModelMessage | null {
  if (!isObject(item)) {
    warn(`Entry ${index} is not an object and was skipped.`)
    return null
  }
  const kind = item.kind
  if (kind !== "request" && kind !== "response") {
    warn(
      `Entry ${index} has kind ${JSON.stringify(kind)} (expected "request" or "response") and was skipped.`
    )
    return null
  }
  const rawParts = Array.isArray(item.parts) ? item.parts : []
  if (!Array.isArray(item.parts)) {
    warn(`Message ${index} has no parts array; treated as empty.`)
  }
  const parts: ModelPart[] = []
  rawParts.forEach((part, partIndex) => {
    if (!isObject(part) || typeof part.part_kind !== "string") {
      warn(
        `Message ${index}, part ${partIndex} has no part_kind and was skipped.`
      )
      return
    }
    if (!isKnownPartKind(part.part_kind)) {
      warn(
        `Message ${index}, part ${partIndex}: unknown part_kind "${part.part_kind}" (shown as raw JSON).`
      )
    }
    parts.push(part as ModelPart)
  })
  return { ...item, kind, parts } as ModelMessage
}

interface Line {
  messages: ModelMessage[]
  entryIds: string[]
}

/**
 * Read a `ConversationStore`'s entries as histories. Each entry points at the
 * one before it, so a history is the chain from a tip back to the first entry
 * (or to an entry whose parent is not in the input, as with `limit=`).
 *
 * The current history ends at the record's `head_id`. Without a record it ends
 * at the newest entry that no other entry follows: entry ids are UUIDv7, so
 * the greatest id is the newest. The branches are the record's `branches`, or
 * without a record every other entry nothing follows.
 */
function readEntries(
  rows: EntryRow[],
  record: Record<string, unknown> | undefined,
  warn: (warning: string) => void
): { head: Line; branches: ConversationBranch[] } {
  const byId = new Map<string, EntryRow>()
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row)
  const parents = new Set<string>()
  for (const row of byId.values()) {
    if (typeof row.parent_id === "string") parents.add(row.parent_id)
  }
  const leaves = [...byId.values()].filter((row) => !parents.has(row.id))

  let headId = record ? optionalString(record.head_id) : null
  if (headId != null && !byId.has(headId)) {
    warn(
      `The record's head_id "${headId}" is not among the entries; showing the newest history instead.`
    )
    headId = null
  }
  headId ??= (leaves.length > 0 ? leaves : rows).reduce((newest, row) =>
    row.id > newest.id ? row : newest
  ).id

  const line = (tipId: string): Line => {
    const chain: EntryRow[] = []
    const seen = new Set<string>()
    let id: unknown = tipId
    while (typeof id === "string" && byId.has(id) && !seen.has(id)) {
      seen.add(id)
      const row = byId.get(id)!
      chain.push(row)
      id = row.parent_id
    }
    chain.reverse()
    const result: Line = { messages: [], entryIds: [] }
    chain.forEach((row, index) => {
      if (typeof row.kind === "string" && row.kind !== "message") {
        warn(
          `Entry "${row.id}" has kind "${row.kind}" (expected "message") and was skipped.`
        )
        return
      }
      const message = toMessage(row.message, index, warn)
      if (!message) return
      result.messages.push(message)
      result.entryIds.push(row.id)
    })
    return result
  }

  const head = line(headId)
  let tips: string[]
  if (record && Array.isArray(record.branches)) {
    tips = []
    for (const tip of record.branches) {
      if (typeof tip !== "string") continue
      if (byId.has(tip)) tips.push(tip)
      else warn(`Branch "${tip}" is not among the entries and was skipped.`)
    }
  } else {
    tips = leaves.map((row) => row.id)
  }
  const branches: ConversationBranch[] = []
  for (const tipId of tips) {
    if (tipId === headId || branches.some((b) => b.tipId === tipId)) continue
    const branch = line(tipId)
    if (branch.messages.length === 0) continue
    let sharedCount = 0
    while (
      sharedCount < branch.entryIds.length &&
      branch.entryIds[sharedCount] === head.entryIds[sharedCount]
    ) {
      sharedCount++
    }
    branches.push({ tipId, ...branch, sharedCount })
  }
  return { head, branches }
}

/**
 * Accept a pydantic-ai history in every shape it tends to show up in and
 * return a clean list of messages:
 *
 * - a JSON string, or an already parsed value
 * - a plain array of messages (`all_messages_json()`)
 * - a `Conversation` (`ConversationTypeAdapter.dump_json(result.conversation)`),
 *   or any other `{ messages: [...] }` wrapper
 * - `ConversationStore` entries (`load_entries()`): rows of
 *   `{ id, parent_id, message }`, ordered by following `parent_id` back from
 *   the newest entry
 * - a stored conversation, `{ record, entries }`: the store's
 *   `ConversationRecord` and the entries it reaches, branches included
 * - an array of `{ message: {...} }` wrappers (one row per message, as a
 *   database export might produce; a `sequence_num` field orders them)
 * - a single message object
 *
 * A conversation's usage, id and pending deferred tool requests come back as
 * `conversation`; store entries also yield each message's entry id and the
 * branches the conversation has left.
 *
 * Unknown `part_kind` values are kept so nothing silently disappears; they
 * render as neutral raw-JSON nodes. Only input that is not JSON, or holds no
 * message at all, throws.
 */
export function parseMessages(input: unknown): ParseResult {
  const warnings: string[] = []
  // Branches repeat the history they share, so the same warning can recur.
  const warn = (warning: string) => {
    if (!warnings.includes(warning)) warnings.push(warning)
  }
  let value: unknown = input

  if (typeof value === "string") {
    const text = value.trim()
    if (!text) throw new TurnMapParseError("The input is empty.")
    try {
      value = JSON.parse(text)
    } catch (error) {
      throw new TurnMapParseError(
        `The input is not valid JSON: ${(error as Error).message}`
      )
    }
  }

  let conversation: ConversationInfo | undefined
  let record: Record<string, unknown> | undefined
  if (isObject(value) && Array.isArray(value.entries)) {
    // A stored conversation: `{ record, entries }`.
    if (isObject(value.record)) {
      record = value.record
      conversation = conversationInfo(record)
    }
    value = value.entries
  } else if (isObject(value) && Array.isArray(value.messages)) {
    // A `Conversation`, or a plain `{ messages: [...] }` wrapper.
    conversation = conversationInfo(value)
    value = value.messages
  }

  // A single message object.
  if (
    isObject(value) &&
    (value.kind === "request" || value.kind === "response")
  ) {
    value = [value]
  }

  if (!Array.isArray(value)) {
    throw new TurnMapParseError(
      "Expected a JSON array of messages (the output of all_messages_json()), a Conversation, or a store's entries."
    )
  }

  let messages: ModelMessage[] = []
  let entryIds: string[] | undefined
  let branches: ConversationBranch[] | undefined
  if (isEntryRows(value)) {
    const read = readEntries(value, record, warn)
    messages = read.head.messages
    entryIds = read.head.entryIds
    branches = read.branches
  } else {
    // Row wrappers: `{ message: {...}, sequence_num?: n }`.
    let items: unknown[] = value
    if (
      items.length > 0 &&
      items.every((it) => isObject(it) && isObject(it.message))
    ) {
      const rows = items as Record<string, unknown>[]
      const ordered = rows.every((r) => typeof r.sequence_num === "number")
        ? [...rows].sort(
            (a, b) => (a.sequence_num as number) - (b.sequence_num as number)
          )
        : rows
      items = ordered.map((r) => r.message)
    }
    items.forEach((item, index) => {
      const message = toMessage(item, index, warn)
      if (message) messages.push(message)
    })
  }

  if (messages.length === 0) {
    throw new TurnMapParseError("No messages found in the input.")
  }

  return {
    messages,
    warnings,
    ...(conversation && { conversation }),
    ...(entryIds && { entryIds }),
    ...(branches && { branches }),
  }
}

/** Parse a tool call's `args`, which pydantic-ai stores as a JSON string or an object. */
export function parseToolArgs(args: unknown): unknown {
  if (typeof args !== "string") return args
  const text = args.trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return args
  }
}

/** Flatten a `content` value (string, multimodal list, or anything else) to display text. */
export function contentToText(content: unknown): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (isObject(item)) {
          if (
            typeof item.content === "string" &&
            item.kind === "text-content"
          ) {
            return item.content
          }
          if (typeof item.text === "string") return item.text
        }
        return ""
      })
      .filter(Boolean)
      .join("\n")
  }
  if (isObject(content) && typeof content.text === "string") return content.text
  return stringify(content)
}

export function stringify(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export interface TruncateOptions {
  /** Longest string value kept intact; longer ones are cut at the end with an ellipsis. */
  maxString?: number
  /** Longest array kept intact; longer ones keep the first items plus a marker. */
  maxItems?: number
}

/**
 * Deep copy of a JSON value with long string values cut at the end and long
 * arrays shortened, so a preview keeps the structure (every key, every
 * nesting level) readable while the full value lives elsewhere.
 */
export function truncateJson(
  value: unknown,
  { maxString = 300, maxItems = 25 }: TruncateOptions = {}
): unknown {
  if (typeof value === "string") {
    return value.length > maxString
      ? `${value.slice(0, maxString)}… (${value.length - maxString} more chars)`
      : value
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, maxItems)
      .map((v) => truncateJson(v, { maxString, maxItems }))
    if (value.length > maxItems)
      items.push(`… (${value.length - maxItems} more items)`)
    return items
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value))
      out[k] = truncateJson(v, { maxString, maxItems })
    return out
  }
  return value
}
