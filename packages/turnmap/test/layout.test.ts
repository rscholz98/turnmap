import { describe, expect, it } from "vitest"

import { buildGraph } from "../src/graph"
import { layoutGraph } from "../src/layout"
import { parseMessages } from "../src/parse"
import { FIXTURES } from "./fixtures"

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  )
}

describe("layoutGraph", () => {
  it("positions every part without overlap and wraps messages in groups", () => {
    for (const [name, data] of Object.entries(FIXTURES)) {
      const graph = buildGraph(parseMessages(data).messages)
      const laid = layoutGraph(graph.nodes, graph.edges, graph.groups)
      const parts = laid.filter((n) => n.type !== "messageGroup")
      const groups = laid.filter((n) => n.type === "messageGroup")
      expect(parts, name).toHaveLength(graph.nodes.length)
      expect(groups, name).toHaveLength(graph.groups.length)
      const boxes = parts.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        w: n.initialWidth ?? 0,
        h: n.initialHeight ?? 0,
      }))
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(
            overlaps(boxes[i], boxes[j]),
            `${name}: ${parts[i].id} vs ${parts[j].id}`
          ).toBe(false)
        }
      }
      for (const group of groups) {
        const gb = {
          x: group.position.x,
          y: group.position.y,
          w: group.width!,
          h: group.height!,
        }
        for (const id of (group.data as { partIds: string[] }).partIds) {
          const p = parts.find((n) => n.id === id)!
          expect(
            p.position.x >= gb.x && p.position.y >= gb.y,
            `${name}: ${id} inside ${group.id}`
          ).toBe(true)
          expect(
            p.position.x + p.initialWidth! <= gb.x + gb.w &&
              p.position.y + p.initialHeight! <= gb.y + gb.h,
            `${name}: ${id} inside ${group.id}`
          ).toBe(true)
        }
      }
    }
  })

  it("flows downward in TB and rightward in LR", () => {
    const graph = buildGraph(parseMessages(FIXTURES["simple-chat"]).messages)
    const tb = layoutGraph(graph.nodes, graph.edges, graph.groups, {
      direction: "TB",
    })
    const lr = layoutGraph(graph.nodes, graph.edges, graph.groups, {
      direction: "LR",
    })
    const y = (nodes: typeof tb, id: string) =>
      nodes.find((n) => n.id === id)!.position.y
    const x = (nodes: typeof tb, id: string) =>
      nodes.find((n) => n.id === id)!.position.x
    expect(y(tb, "m0p0")).toBeLessThan(y(tb, "m3p0"))
    expect(x(lr, "m0p0")).toBeLessThan(x(lr, "m3p0"))
  })

  it("uses measured sizes when given", () => {
    const graph = buildGraph(parseMessages(FIXTURES["simple-chat"]).messages)
    const sizes = new Map(
      graph.nodes.map((n) => [n.id, { width: 320, height: 500 }])
    )
    const laid = layoutGraph(graph.nodes, graph.edges, graph.groups, { sizes })
    expect(laid.find((n) => n.id === "m0p0")!.initialHeight).toBe(500)
  })
})
