import { describe, expect, it } from "vitest"

import { buildGraph, partNodeId } from "../src/graph"
import { parseMessages } from "../src/parse"
import {
  DELTAS,
  FIXTURES,
  LEGACY_RETRY,
  PAUSED_CONVERSATION,
  STORED_CONVERSATION,
  type FixtureName,
} from "./fixtures"

function graphOf(name: FixtureName) {
  return buildGraph(parseMessages(FIXTURES[name]).messages)
}

function edge(
  graph: ReturnType<typeof buildGraph>,
  source: string,
  target: string
) {
  return graph.edges.find((e) => e.source === source && e.target === target)
}

describe("buildGraph", () => {
  it("creates one node per part and one group per message", () => {
    const messages = parseMessages(FIXTURES["tool-calls"]).messages
    const graph = buildGraph(messages)
    const partCount = messages.reduce((n, m) => n + m.parts.length, 0)
    expect(graph.nodes).toHaveLength(partCount)
    expect(graph.groups).toHaveLength(messages.length)
    expect(graph.groups.map((g) => g.ordinal)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it("chains prompts and responses with flow edges", () => {
    const graph = graphOf("simple-chat")
    // m0: system, user -> m1: text -> m2: user -> m3: text
    expect(edge(graph, partNodeId(0, 0), partNodeId(0, 1))?.data?.kind).toBe(
      "flow"
    )
    expect(edge(graph, partNodeId(0, 1), partNodeId(1, 0))?.data?.kind).toBe(
      "flow"
    )
    expect(edge(graph, partNodeId(1, 0), partNodeId(2, 0))?.data?.kind).toBe(
      "flow"
    )
    expect(edge(graph, partNodeId(2, 0), partNodeId(3, 0))?.data?.kind).toBe(
      "flow"
    )
    expect(graph.edges).toHaveLength(4)
  })

  it("fans parallel tool calls out and converges their returns on the next response", () => {
    const graph = graphOf("tool-calls")
    // m1 holds two tool calls, both branch from the user prompt m0p1.
    expect(edge(graph, partNodeId(0, 1), partNodeId(1, 0))?.data?.kind).toBe(
      "call"
    )
    expect(edge(graph, partNodeId(0, 1), partNodeId(1, 1))?.data?.kind).toBe(
      "call"
    )
    // m2 holds the two returns, each hanging off its call.
    expect(edge(graph, partNodeId(1, 0), partNodeId(2, 0))?.data?.kind).toBe(
      "return"
    )
    expect(edge(graph, partNodeId(1, 1), partNodeId(2, 1))?.data?.kind).toBe(
      "return"
    )
    // Both returns feed the answer m3p0.
    expect(edge(graph, partNodeId(2, 0), partNodeId(3, 0))?.data?.kind).toBe(
      "flow"
    )
    expect(edge(graph, partNodeId(2, 1), partNodeId(3, 0))?.data?.kind).toBe(
      "flow"
    )
    const call = graph.nodes.find((n) => n.id === partNodeId(1, 0))
    expect(call?.type).toBe("toolCall")
    expect(call?.data).toMatchObject({
      toolName: "get_order",
      answered: true,
      outcome: "success",
    })
    expect((call?.data as { args: unknown }).args).toEqual({
      order_id: "A-1042",
    })
  })

  it("links a validation retry to its tool call and an output retry to the chain", () => {
    const graph = graphOf("retry")
    const toolRetry = graph.nodes.find((n) => n.id === partNodeId(2, 0))
    expect(toolRetry?.type).toBe("retry")
    expect(toolRetry?.data).toMatchObject({
      toolName: "book_table",
      linked: true,
    })
    expect((toolRetry?.data as { errors: unknown[] }).errors).toHaveLength(2)
    expect(edge(graph, partNodeId(1, 0), partNodeId(2, 0))?.data?.kind).toBe(
      "retry"
    )
    const call = graph.nodes.find((n) => n.id === partNodeId(1, 0))
    expect(call?.data).toMatchObject({ outcome: "retry" })

    const outputRetry = graph.nodes.find((n) => n.id === partNodeId(6, 0))
    expect(outputRetry?.data).toMatchObject({ toolName: null, linked: false })
    expect(edge(graph, partNodeId(5, 0), partNodeId(6, 0))?.data?.kind).toBe(
      "retry"
    )
    expect(edge(graph, partNodeId(6, 0), partNodeId(7, 0))?.data?.kind).toBe(
      "flow"
    )
  })

  it("keeps a native call and return pair inside one response", () => {
    const graph = graphOf("builtin-tools")
    const call = graph.nodes.find((n) => n.id === partNodeId(1, 0))
    const ret = graph.nodes.find((n) => n.id === partNodeId(1, 1))
    expect(call?.data).toMatchObject({ builtin: true, providerName: "openai" })
    expect(ret?.data).toMatchObject({ builtin: true, linked: true })
    expect(edge(graph, partNodeId(1, 0), partNodeId(1, 1))?.data?.kind).toBe(
      "return"
    )
    expect(edge(graph, partNodeId(1, 1), partNodeId(1, 2))?.data?.kind).toBe(
      "flow"
    )
  })

  it("collects attachments and thinking from the multimodal fixture", () => {
    const graph = graphOf("multimodal")
    const user = graph.nodes.find((n) => n.id === partNodeId(0, 1))
    expect(user?.type).toBe("prompt")
    expect((user?.data as { attachments: unknown[] }).attachments).toHaveLength(
      2
    )
    expect((user?.data as { text: string }).text).toMatch(/not heating/)
    const thinking = graph.nodes.find((n) => n.id === partNodeId(1, 0))
    expect(thinking?.type).toBe("thinking")
  })

  it("marks unmatched returns and unanswered calls", () => {
    const graph = buildGraph(
      parseMessages([
        {
          kind: "request",
          parts: [{ part_kind: "user-prompt", content: "hi" }],
        },
        {
          kind: "response",
          parts: [
            {
              part_kind: "tool-call",
              tool_name: "t",
              args: "{}",
              tool_call_id: "x",
            },
          ],
        },
        {
          kind: "request",
          parts: [
            {
              part_kind: "tool-return",
              tool_name: "t",
              content: 1,
              tool_call_id: "other",
            },
          ],
        },
      ]).messages
    )
    expect(graph.nodes[1].data).toMatchObject({
      answered: false,
      outcome: null,
    })
    expect(graph.nodes[2].data).toMatchObject({ linked: false })
    // The unmatched return joins the chain after the previous message's leaf (the call).
    expect(edge(graph, partNodeId(1, 0), partNodeId(2, 0))?.data?.kind).toBe(
      "flow"
    )
  })

  it("every fixture starts with a system prompt", () => {
    for (const [name, data] of Object.entries(FIXTURES)) {
      const first = parseMessages(data).messages[0]
      expect(first.kind, name).toBe("request")
      expect(first.parts[0].part_kind, name).toBe("system-prompt")
    }
  })

  it("keeps the denied outcome of an approval and links the structured final_result call", () => {
    const approvals = graphOf("approvals")
    const denied = approvals.nodes.find(
      (n) =>
        n.type === "toolReturn" &&
        (n.data as { outcome?: string }).outcome === "denied"
    )
    expect(denied?.data).toMatchObject({
      toolName: "delete_file",
      linked: true,
    })
    const structured = graphOf("structured-output")
    const final = structured.nodes.find(
      (n) =>
        n.type === "toolCall" &&
        (n.data as { toolName: string }).toolName === "final_result"
    )
    expect(final?.data).toMatchObject({ answered: true, outcome: "success" })
  })
})

describe("retries", () => {
  const retries = (data: unknown) =>
    buildGraph(parseMessages(data).messages).nodes.filter(
      (n) => n.type === "retry"
    )

  it("reads a retried tool return and retry feedback with why and which attempt", () => {
    const [tool, output] = retries(FIXTURES.retry)
    expect(tool.data).toMatchObject({
      partKind: "tool-return",
      toolName: "book_table",
      linked: true,
      cause: "validation_error",
      attempt: 1,
      maxRetries: 3,
    })
    expect(tool.data.errors?.length).toBeGreaterThan(0)
    expect(output.data).toMatchObject({
      partKind: "retry-feedback",
      toolName: null,
      toolCallId: "",
      linked: false,
      cause: "model_retry",
      attempt: 1,
    })
    expect(output.data.text).toMatch(/confirmation number/)
  })

  it("draws no tool-return node for a retried call", () => {
    const graph = graphOf("retry")
    const returns = graph.nodes.filter((n) => n.type === "toolReturn")
    expect(returns.map((n) => n.data.outcome)).toEqual(["success"])
  })

  it("builds the same graph shape from the legacy retry-prompt parts", () => {
    const shape = (data: unknown) => {
      const graph = buildGraph(parseMessages(data).messages)
      return {
        nodes: graph.nodes.map((n) => n.type),
        edges: graph.edges.map(
          (e) => `${e.source}>${e.target}:${e.data?.kind}`
        ),
      }
    }
    expect(shape(LEGACY_RETRY)).toEqual(shape(FIXTURES.retry))
    const [tool, output] = retries(LEGACY_RETRY)
    expect(tool.data).toMatchObject({ toolName: "book_table", cause: null })
    expect(output.data).toMatchObject({ toolName: null, attempt: null })
  })
})

describe("change records", () => {
  it("draws instruction, settings and capability changes as notes", () => {
    const graph = buildGraph(parseMessages(DELTAS).messages)
    expect(graph.nodes.some((n) => n.type === "unknown")).toBe(false)
    const notes = graph.nodes
      .filter((n) => n.type === "note")
      .map((n) => ({ title: n.data.title, lines: n.data.lines }))
    expect(notes).toEqual([
      {
        title: "Instructions baseline",
        lines: [
          "block (unchanged, recorded by hash)",
          "tone: Answer in a friendly tone.",
        ],
      },
      { title: "Model settings changed", lines: ["thinking: high"] },
      {
        title: "Instruction changed",
        lines: ["tone: Answer formally: this is a billing dispute."],
      },
      { title: "Instruction withdrawn", lines: ["promo"] },
      { title: "Capabilities loaded", lines: ["billing"] },
    ])
  })
})

describe("buildGraph with a conversation", () => {
  it("marks the calls a paused conversation is waiting on", () => {
    const parsed = parseMessages(PAUSED_CONVERSATION)
    const graph = buildGraph(parsed.messages, {
      deferredToolRequests: parsed.conversation?.deferredToolRequests,
    })
    const calls = Object.fromEntries(
      graph.nodes
        .filter((n) => n.type === "toolCall")
        .map((n) => [n.data.toolName, n.data])
    )
    expect(calls.get_order.pending).toBeNull()
    expect(calls.get_order.outcome).toBe("success")
    expect(calls.refund_order.pending).toBe("approval")
    expect(calls.refund_order.deferredMetadata).toBeNull()
    expect(calls.schedule_pickup.pending).toBe("external")
    expect(calls.schedule_pickup.deferredMetadata).toEqual({
      queue: "logistics",
      carrier: "DHL",
    })
  })

  it("leaves unanswered calls unmarked without the conversation", () => {
    const graph = buildGraph(parseMessages(PAUSED_CONVERSATION).messages)
    const pending = graph.nodes
      .filter((n) => n.type === "toolCall")
      .map((n) => n.data.pending)
    expect(pending).toEqual([null, null, null])
  })

  it("carries entry ids and branch counts onto the message groups", () => {
    const parsed = parseMessages(STORED_CONVERSATION)
    const graph = buildGraph(parsed.messages, {
      entryIds: parsed.entryIds,
      branchCounts: new Map([[1, 1]]),
    })
    expect(graph.groups.map((g) => g.entryId)).toEqual(parsed.entryIds)
    expect(graph.groups.map((g) => g.branchCount)).toEqual([0, 1, 0, 0, 0, 0])
    expect(graph.groups[0].conversationId).toBe("support-42")
  })
})
