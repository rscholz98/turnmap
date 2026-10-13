import { describe, expect, it } from "vitest"

import { buildGraph, partNodeId } from "../src/graph"
import { parseMessages } from "../src/parse"
import { FIXTURES, type FixtureName } from "./fixtures"

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
})
