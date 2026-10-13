import type { ModelMessage, ModelPart } from "./schema"
import { isKnownPartKind } from "./schema"

export interface ParseResult {
  messages: ModelMessage[]
  /** Non-fatal observations: unknown part kinds, skipped entries, etc. */
  warnings: string[]
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

/**
 * Accept the raw `all_messages_json()` output in every shape it tends to show
 * up in and return a clean list of messages:
 *
 * - a JSON string, or an already parsed value
 * - a plain array of messages
 * - `{ messages: [...] }` (common when a backend wraps the history)
 * - an array of `{ message: {...} }` wrappers (one row per message, as a
 *   database export might produce; a `sequence_num` field orders them)
 * - a single message object
 *
 * Unknown `part_kind` values are kept so nothing silently disappears; they
 * render as neutral raw-JSON nodes. Only input that is not JSON, or holds no
 * message at all, throws.
 */
export function parseMessages(input: unknown): ParseResult {
  const warnings: string[] = []
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

  // `{ messages: [...] }` wrapper.
  if (isObject(value) && Array.isArray(value.messages)) {
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
      "Expected a JSON array of messages (the output of all_messages_json())."
    )
  }

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

  const messages: ModelMessage[] = []
  items.forEach((item, index) => {
    if (!isObject(item)) {
      warnings.push(`Entry ${index} is not an object and was skipped.`)
      return
    }
    const kind = item.kind
    if (kind !== "request" && kind !== "response") {
      warnings.push(
        `Entry ${index} has kind ${JSON.stringify(kind)} (expected "request" or "response") and was skipped.`
      )
      return
    }
    const rawParts = Array.isArray(item.parts) ? item.parts : []
    if (!Array.isArray(item.parts)) {
      warnings.push(`Message ${index} has no parts array; treated as empty.`)
    }
    const parts: ModelPart[] = []
    rawParts.forEach((part, partIndex) => {
      if (!isObject(part) || typeof part.part_kind !== "string") {
        warnings.push(
          `Message ${index}, part ${partIndex} has no part_kind and was skipped.`
        )
        return
      }
      if (!isKnownPartKind(part.part_kind)) {
        warnings.push(
          `Message ${index}, part ${partIndex}: unknown part_kind "${part.part_kind}" (shown as raw JSON).`
        )
      }
      parts.push(part as ModelPart)
    })
    messages.push({ ...item, kind, parts } as ModelMessage)
  })

  if (messages.length === 0) {
    throw new TurnMapParseError("No messages found in the input.")
  }

  return { messages, warnings }
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
