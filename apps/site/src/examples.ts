import builtinTools from "../../../examples/builtin-tools.json"
import multimodal from "../../../examples/multimodal.json"
import retry from "../../../examples/retry.json"
import simpleChat from "../../../examples/simple-chat.json"
import toolCalls from "../../../examples/tool-calls.json"

export interface Example {
  id: string
  name: string
  description: string
  messages: unknown[]
}

export const EXAMPLES: Example[] = [
  {
    id: "simple-chat",
    name: "Simple chat",
    description: "System prompt, two user turns, two answers.",
    messages: simpleChat,
  },
  {
    id: "tool-calls",
    name: "Parallel tool calls",
    description:
      "Two tools called at once, their returns, and a follow-up turn.",
    messages: toolCalls,
  },
  {
    id: "retry",
    name: "Validation retries",
    description:
      "Invalid tool arguments and an output validator sending the model back.",
    messages: retry,
  },
  {
    id: "multimodal",
    name: "Multimodal prompt",
    description:
      "Image URL and inline binary in the user prompt, plus a thinking part.",
    messages: multimodal,
  },
  {
    id: "builtin-tools",
    name: "Provider tools",
    description: "A web search executed by the provider inside one response.",
    messages: builtinTools,
  },
]
