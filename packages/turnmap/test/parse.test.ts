import { describe, expect, it } from "vitest"

import {
  contentToText,
  parseMessages,
  parseToolArgs,
  TurnMapParseError,
} from "../src/parse"
import { FIXTURES } from "./fixtures"

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
