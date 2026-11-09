import approvals from "../../../examples/approvals.json"
import builtinTools from "../../../examples/builtin-tools.json"
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

/** A serialized `Conversation`, paused on one approval and one external call. */
export const PAUSED_CONVERSATION = pausedConversation

/**
 * A `ConversationStore`'s record and entries: six messages in the current
 * history, and a two-message branch left after the second message.
 */
export const STORED_CONVERSATION = storedConversation
