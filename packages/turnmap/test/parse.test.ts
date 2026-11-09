import { describe, expect, it } from "vitest"

import {
  contentToText,
  parseMessages,
  parseToolArgs,
  truncateJson,
  TurnMapParseError,
} from "../src/parse"
import { FIXTURES, PAUSED_CONVERSATION, STORED_CONVERSATION } from "./fixtures"

describe("parseMessages", () => {
  it("parses every fixture without warnings", () => {
    for (const [name, data] of Object.entries(FIXTURES)) {
      const result = parseMessages(data)
      expect(result.warnings, name).toEqual([])
      expect(result.messages.length, name).toBe((data as unknown[]).length)
    }
  })

  it("accepts a JSON string", () => {
    const result = parseMessages(JSON.stringify(FIXTURES["simple-chat"]))
    expect(result.messages).toHaveLength(4)
    expect(result.messages[0].kind).toBe("request")
  })

  it("accepts a { messages } wrapper and a single message", () => {
    const wrapped = parseMessages({ messages: FIXTURES["simple-chat"] })
    expect(wrapped.messages).toHaveLength(4)
    const single = parseMessages(FIXTURES["simple-chat"][1])
    expect(single.messages).toHaveLength(1)
  })

  it("unwraps { message } rows and orders them by sequence_num", () => {
    const rows = FIXTURES["simple-chat"].map((message, i) => ({
      id: `row-${i}`,
      sequence_num: i,
      message,
    }))
    const shuffled = [rows[2], rows[0], rows[3], rows[1]]
    const result = parseMessages(shuffled)
    expect(result.messages.map((m) => m.kind)).toEqual([
      "request",
      "response",
      "request",
      "response",
    ])
  })

  it("reads a Conversation and what it carries besides its messages", () => {
    const result = parseMessages(PAUSED_CONVERSATION)
    expect(result.warnings).toEqual([])
    expect(result.messages).toHaveLength(4)
    expect(result.conversation?.conversationId).toBe("returns-a-1042")
    expect(result.conversation?.usage?.requests).toBe(2)
    expect(result.conversation?.usage?.tool_calls).toBe(1)
    const requests = result.conversation?.deferredToolRequests
    expect(requests?.approvals?.map((c) => c.tool_name)).toEqual([
      "refund_order",
    ])
    expect(requests?.calls?.map((c) => c.tool_name)).toEqual([
      "schedule_pickup",
    ])
    expect(result.entryIds).toBeUndefined()
    expect(result.branches).toBeUndefined()
  })

  it("leaves a plain { messages } wrapper without conversation info", () => {
    const result = parseMessages({ messages: FIXTURES["simple-chat"] })
    expect(result.conversation).toBeUndefined()
  })

  it("reads a stored conversation: the head history and the branch it left", () => {
    const result = parseMessages(STORED_CONVERSATION)
    expect(result.warnings).toEqual([])
    expect(result.messages).toHaveLength(6)
    expect(result.entryIds).toHaveLength(6)
    expect(result.entryIds?.at(-1)).toBe(STORED_CONVERSATION.record.head_id)
    expect(result.conversation?.conversationId).toBe("support-42")
    expect(result.conversation?.scope).toBe("user-7")
    expect(result.conversation?.usage?.requests).toBe(4)
    expect(result.branches).toHaveLength(1)
    const [branch] = result.branches!
    expect(branch.tipId).toBe(STORED_CONVERSATION.record.branches[0])
    expect(branch.messages).toHaveLength(4)
    expect(branch.sharedCount).toBe(2)
    expect(branch.entryIds.slice(0, 2)).toEqual(result.entryIds?.slice(0, 2))
    expect(branch.entryIds[2]).not.toBe(result.entryIds?.[2])
  })

  it("orders store entries by parent_id, whatever order they arrive in", () => {
    const head = parseMessages(STORED_CONVERSATION)
    const entries = [...STORED_CONVERSATION.entries].reverse()
    const result = parseMessages({
      record: STORED_CONVERSATION.record,
      entries,
    })
    expect(result.entryIds).toEqual(head.entryIds)
    expect(result.messages).toEqual(head.messages)
  })

  it("reads bare entries: the newest entry nothing follows is the head", () => {
    const stored = parseMessages(STORED_CONVERSATION)
    for (const entries of [
      STORED_CONVERSATION.entries,
      [...STORED_CONVERSATION.entries].reverse(),
    ]) {
      const result = parseMessages(entries)
      expect(result.conversation).toBeUndefined()
      expect(result.messages).toEqual(stored.messages)
      expect(result.entryIds).toEqual(stored.entryIds)
      expect(result.branches).toEqual(stored.branches)
    }
  })

  it("reads a window of entries whose first parent is not included", () => {
    const stored = parseMessages(STORED_CONVERSATION)
    const window = STORED_CONVERSATION.entries.filter((entry) =>
      stored.entryIds!.slice(-3).includes(entry.id)
    )
    const result = parseMessages(window)
    expect(result.messages).toEqual(stored.messages.slice(-3))
    expect(result.branches).toEqual([])
  })

  it("skips entries of a kind it does not know and warns once", () => {
    const [first, second, ...rest] = STORED_CONVERSATION.entries
    const marker = {
      id: "marker-1",
      parent_id: first.id,
      kind: "checkpoint",
      label: "before the regenerate",
    }
    const result = parseMessages({
      record: STORED_CONVERSATION.record,
      entries: [first, marker, { ...second, parent_id: marker.id }, ...rest],
    })
    expect(result.messages).toHaveLength(6)
    expect(result.entryIds).not.toContain("marker-1")
    expect(result.branches![0].sharedCount).toBe(2)
    expect(result.warnings).toEqual([
      'Entry "marker-1" has kind "checkpoint" (expected "message") and was skipped.',
    ])
  })

  it("warns when the record names a head or branch the entries lack", () => {
    const result = parseMessages({
      record: {
        ...STORED_CONVERSATION.record,
        head_id: "gone",
        branches: ["also-gone"],
      },
      entries: STORED_CONVERSATION.entries,
    })
    expect(result.messages.length).toBeGreaterThan(0)
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings[0]).toMatch(/head_id "gone"/)
    expect(result.warnings[1]).toMatch(/Branch "also-gone"/)
  })

  it("keeps unknown part kinds and warns", () => {
    const result = parseMessages([
      { kind: "request", parts: [{ part_kind: "future-part", foo: 1 }] },
    ])
    expect(result.messages[0].parts[0].part_kind).toBe("future-part")
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toMatch(/unknown part_kind/)
  })

  it("skips entries that are not messages and warns", () => {
    const result = parseMessages([
      { kind: "request", parts: [] },
      { kind: "nope", parts: [] },
      42,
    ])
    expect(result.messages).toHaveLength(1)
    expect(result.warnings).toHaveLength(2)
  })

  it("throws a TurnMapParseError on bad input", () => {
    expect(() => parseMessages("")).toThrow(TurnMapParseError)
    expect(() => parseMessages("{not json")).toThrow(/not valid JSON/)
    expect(() => parseMessages({ hello: "world" })).toThrow(/array/)
    expect(() => parseMessages([])).toThrow(/No messages/)
  })
})

describe("parseToolArgs", () => {
  it("parses JSON strings and passes objects through", () => {
    expect(parseToolArgs('{"a": 1}')).toEqual({ a: 1 })
    expect(parseToolArgs({ a: 1 })).toEqual({ a: 1 })
    expect(parseToolArgs(null)).toBeNull()
    expect(parseToolArgs("not json")).toBe("not json")
  })
})

describe("contentToText", () => {
  it("flattens multimodal content to its text items", () => {
    expect(
      contentToText([
        "Look at this",
        { kind: "image-url", url: "https://x/y.png" },
        { kind: "text-content", content: "and this" },
      ])
    ).toBe("Look at this\nand this")
    expect(contentToText("plain")).toBe("plain")
    expect(contentToText(null)).toBe("")
  })
})

describe("truncateJson", () => {
  it("cuts long strings at the end and keeps every key and nesting level", () => {
    const long = "x".repeat(500)
    const out = truncateJson(
      { a: { b: long, c: [1, long] }, d: 5 },
      { maxString: 10 }
    ) as {
      a: { b: string; c: [number, string] }
      d: number
    }
    expect(out.a.b).toBe("xxxxxxxxxx… (490 more chars)")
    expect(out.a.c[0]).toBe(1)
    expect(out.a.c[1]).toMatch(/^xxxxxxxxxx…/)
    expect(out.d).toBe(5)
  })

  it("shortens long arrays with a marker", () => {
    const out = truncateJson(
      Array.from({ length: 150 }, (_, i) => i),
      { maxItems: 100 }
    ) as unknown[]
    expect(out).toHaveLength(101)
    expect(out[100]).toBe("… (50 more items)")
  })
})
