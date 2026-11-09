import approvals from "../../../examples/approvals.json"
import builtinTools from "../../../examples/builtin-tools.json"
import deltas from "./fixtures/deltas.json"
import legacyRetry from "./fixtures/legacy-retry.json"
import delegation from "../../../examples/delegation.json"
import multimodal from "../../../examples/multimodal.json"
import pausedConversation from "../../../examples/paused-conversation.json"
import retry from "../../../examples/retry.json"
import simpleChat from "../../../examples/simple-chat.json"
import storedConversation from "../../../examples/stored-conversation.json"
import structuredOutput from "../../../examples/structured-output.json"
import toolCalls from "../../../examples/tool-calls.json"

export const FIXTURES = {
  "simple-chat": simpleChat,
  "tool-calls": toolCalls,
  retry,
  multimodal,
  "builtin-tools": builtinTools,
  "structured-output": structuredOutput,
  approvals,
  delegation,
} as const

export type FixtureName = keyof typeof FIXTURES

/**
 * The retry example as pydantic-ai wrote it before 2.60: both retries are
 * `retry-prompt` parts. Stored histories still look like this.
 */
export const LEGACY_RETRY = legacyRetry

/**
 * The parts that record a change to instructions, model settings or loaded
 * capabilities, built from pydantic-ai's message classes.
 */
export const DELTAS = deltas

/** A serialized `Conversation`, paused on one approval and one external call. */
export const PAUSED_CONVERSATION = pausedConversation

/**
 * A `ConversationStore`'s record and entries: six messages in the current
 * history, and a two-message branch left after the second message.
 */
export const STORED_CONVERSATION = storedConversation
