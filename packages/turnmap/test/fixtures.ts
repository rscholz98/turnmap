import approvals from "../../../examples/approvals.json"
import builtinTools from "../../../examples/builtin-tools.json"
import delegation from "../../../examples/delegation.json"
import multimodal from "../../../examples/multimodal.json"
import retry from "../../../examples/retry.json"
import simpleChat from "../../../examples/simple-chat.json"
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
