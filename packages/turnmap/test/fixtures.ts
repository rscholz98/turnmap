import builtinTools from "../../../examples/builtin-tools.json"
import multimodal from "../../../examples/multimodal.json"
import retry from "../../../examples/retry.json"
import simpleChat from "../../../examples/simple-chat.json"
import toolCalls from "../../../examples/tool-calls.json"

export const FIXTURES = {
  "simple-chat": simpleChat,
  "tool-calls": toolCalls,
  retry,
  multimodal,
  "builtin-tools": builtinTools,
} as const

export type FixtureName = keyof typeof FIXTURES
