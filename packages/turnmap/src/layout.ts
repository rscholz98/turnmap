import dagre from "@dagrejs/dagre"
import type { Edge } from "@xyflow/react"

import {
  groupNodeId,
  type MessageGroupData,
  type MessageGroupNode,
  type PartNode,
  type TurnMapEdge,
  type TurnMapNode,
} from "./graph"

/**
 * - `spine`: prompts and responses in one center column, tool calls in a
 *   column to the right, their returns one column further. Wide and shallow.
 * - `TB` / `LR`: dagre hierarchical layout, top-down or left-right.
 */
export type LayoutMode = "spine" | "TB" | "LR"

/** @deprecated use LayoutMode; kept for the `direction` prop. */
export type Direction = "TB" | "LR"

export interface LayoutOptions {
  mode?: LayoutMode
  /** Measured sizes by node id; falls back to `fallbackSize` per node type. */
  sizes?: Map<string, { width: number; height: number }>
  nodeSeparation?: number
  rankSeparation?: number
  /** Horizontal gap between the spine, call and return columns. */
  columnGap?: number
  /** Padding between a message group's border and its parts. */
  groupPadding?: number
  /** Extra room at the top of a group for its header. */
  groupHeader?: number
}

export interface LayoutResult {
  nodes: TurnMapNode[]
  edges: TurnMapEdge[]
}

export const NODE_WIDTH = 320

/** Handle ids rendered on every part node: a source and a target per side. */
export const HANDLE = {
  source: {
    top: "s-top",
    bottom: "s-bottom",
    left: "s-left",
    right: "s-right",
  },
  target: {
    top: "t-top",
    bottom: "t-bottom",
    left: "t-left",
    right: "t-right",
  },
} as const

const FALLBACK_HEIGHT: Record<string, number> = {
  prompt: 140,
  response: 160,
  thinking: 110,
  toolCall: 170,
  toolReturn: 150,
  retry: 170,
  media: 120,
  note: 100,
  unknown: 120,
}

export function fallbackSize(type: string | undefined) {
  return { width: NODE_WIDTH, height: FALLBACK_HEIGHT[type ?? ""] ?? 140 }
}

type Size = { width: number; height: number }
type Box = { x: number; y: number; width: number; height: number }

function sizer(sizes: LayoutOptions["sizes"]) {
  return (node: PartNode): Size =>
    sizes?.get(node.id) ?? fallbackSize(node.type)
}

// ---------------------------------------------------------------------------
// Spine layout
// ---------------------------------------------------------------------------

interface SpineResult {
  boxes: Map<string, Box>
  /** For every tool call and answer, the spine node of its step (null when none precedes it). */
  spineOf: Map<string, string | null>
}

function spineLayout(
  nodes: PartNode[],
  edges: TurnMapEdge[],
  size: (n: PartNode) => Size,
  columnGap: number,
  rowGap: number,
  stepGap: number
): SpineResult {
  const boxes = new Map<string, Box>()
  const spineOf = new Map<string, string | null>()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const colX = (col: number) => col * (NODE_WIDTH + columnGap)

  // Each tool call attaches to the spine node it branched from (the last
  // spine source of its incoming call edges, else the previous spine node).
  // Each answer attaches to its call.
  const callOf = new Map<string, string>() // answer id -> call id
  for (const e of edges) {
    if (e.data?.kind === "return" || e.data?.kind === "retry") {
      const target = byId.get(e.target)
      const source = byId.get(e.source)
      if (target && source?.type === "toolCall")
        callOf.set(target.id, source.id)
    }
  }
  const isCall = (n: PartNode) => n.type === "toolCall"
  const isAns = (n: PartNode) => callOf.has(n.id)
  const isSpine = (n: PartNode) => !isCall(n) && !isAns(n)

  interface Step {
    spine: PartNode | null
    calls: PartNode[]
  }
  const steps: Step[] = []
  const stepOfCall = new Map<string, Step>()
  let current: Step | null = null
  for (const node of nodes) {
    if (isSpine(node)) {
      current = { spine: node, calls: [] }
      steps.push(current)
    } else if (isCall(node)) {
      if (!current) {
        current = { spine: null, calls: [] }
        steps.push(current)
      }
      current.calls.push(node)
      stepOfCall.set(node.id, current)
    }
  }
  const answersOfCall = new Map<string, PartNode[]>()
  for (const node of nodes) {
    const call = callOf.get(node.id)
    if (!call) continue
    const list = answersOfCall.get(call) ?? []
    list.push(node)
    answersOfCall.set(call, list)
  }

  let y = 0
  for (const step of steps) {
    const spineH = step.spine ? size(step.spine).height : 0
    // Tool rows: a call and its answers side by side; rows stack vertically.
    const rows = step.calls.map((call) => {
      const answers = answersOfCall.get(call.id) ?? []
      const h = Math.max(
        size(call).height,
        ...answers.map((a) => size(a).height)
      )
      return { call, answers, h }
    })
    const toolsH =
      rows.reduce((sum, r) => sum + r.h, 0) +
      Math.max(0, rows.length - 1) * rowGap
    const blockH = Math.max(spineH, toolsH)

    // The spine node sits at the top of its block so the conversation column
    // reads compactly; its tool rows start level with it.
    if (step.spine) {
      boxes.set(step.spine.id, {
        x: colX(0),
        y,
        width: NODE_WIDTH,
        height: spineH,
      })
    }
    let ry = y
    for (const row of rows) {
      spineOf.set(row.call.id, step.spine?.id ?? null)
      for (const answer of row.answers)
        spineOf.set(answer.id, step.spine?.id ?? null)
      const callH = size(row.call).height
      boxes.set(row.call.id, {
        x: colX(1),
        y: ry + (row.h - callH) / 2,
        width: NODE_WIDTH,
        height: callH,
      })
      // Several answers to one call (a retry then a return) stack to the right.
      let ax = colX(2)
      for (const answer of row.answers) {
        const h = size(answer).height
        boxes.set(answer.id, {
          x: ax,
          y: ry + (row.h - h) / 2,
          width: NODE_WIDTH,
          height: h,
        })
        ax += NODE_WIDTH + columnGap
      }
      ry += row.h + rowGap
    }
    y += blockH + stepGap
  }

  // Anything not placed (answers whose call is missing) goes on the spine.
  for (const node of nodes) {
    if (!boxes.has(node.id)) {
      const h = size(node).height
      boxes.set(node.id, { x: colX(0), y, width: NODE_WIDTH, height: h })
      y += h + rowGap
    }
  }
  return { boxes, spineOf }
}

// ---------------------------------------------------------------------------
// Dagre layout
// ---------------------------------------------------------------------------

function dagreLayout(
  nodes: PartNode[],
  edges: Edge[],
  size: (n: PartNode) => Size,
  rankdir: "TB" | "LR",
  nodesep: number,
  ranksep: number
): Map<string, Box> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir, nodesep, ranksep, marginx: 20, marginy: 20 })
  for (const node of nodes) g.setNode(node.id, size(node))
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target))
      g.setEdge(edge.source, edge.target)
  }
  dagre.layout(g)
  const boxes = new Map<string, Box>()
  for (const node of nodes) {
    const { width, height } = size(node)
    const { x, y } = g.node(node.id)
    boxes.set(node.id, { x: x - width / 2, y: y - height / 2, width, height })
  }
  return boxes
}

// ---------------------------------------------------------------------------
// Edge handles
// ---------------------------------------------------------------------------

/**
 * Pick the handle pair for an edge from the two boxes: vertical when the
 * target is mostly below (or above), horizontal when it is mostly beside.
 */
function assignHandles(edge: TurnMapEdge, from: Box, to: Box): TurnMapEdge {
  const fromCx = from.x + from.width / 2
  const fromCy = from.y + from.height / 2
  const toCx = to.x + to.width / 2
  const toCy = to.y + to.height / 2
  const dx = toCx - fromCx
  const dy = toCy - fromCy
  // Boxes in different columns connect side to side, same column top to bottom.
  const horizontal = Math.abs(dx) >= from.width * 0.6
  let sourceHandle: string
  let targetHandle: string
  if (horizontal) {
    sourceHandle = dx > 0 ? HANDLE.source.right : HANDLE.source.left
    targetHandle = dx > 0 ? HANDLE.target.left : HANDLE.target.right
  } else {
    sourceHandle = dy >= 0 ? HANDLE.source.bottom : HANDLE.source.top
    targetHandle = dy >= 0 ? HANDLE.target.top : HANDLE.target.bottom
  }
  return { ...edge, sourceHandle, targetHandle }
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

/**
 * Position the part nodes, wrap each message's parts in a decorative group
 * node, and point every edge at the handles that match the geometry.
 * Part nodes carry `initialWidth` / `initialHeight` (never `width` /
 * `height`, which would force the DOM size); groups carry explicit sizes.
 */
export function layoutGraph(
  nodes: PartNode[],
  edges: TurnMapEdge[],
  groups: MessageGroupData[],
  options: LayoutOptions = {}
): LayoutResult {
  const {
    mode = "spine",
    sizes,
    nodeSeparation = 48,
    rankSeparation = 100,
    columnGap = 72,
    groupPadding = 20,
    groupHeader = 36,
  } = options
  const size = sizer(sizes)

  // Stacked tool rows and consecutive steps each need room for two group
  // paddings and one group header between them.
  const groupClearance = groupPadding * 2 + groupHeader + 12
  const spine =
    mode === "spine"
      ? spineLayout(
          nodes,
          edges,
          size,
          columnGap,
          Math.max(nodeSeparation, groupClearance),
          Math.max(rankSeparation * 0.6, groupClearance)
        )
      : null
  const boxes = spine
    ? spine.boxes
    : dagreLayout(
        nodes,
        edges,
        size,
        mode as "TB" | "LR",
        nodeSeparation,
        rankSeparation
      )

  const positioned: PartNode[] = nodes.map((node) => {
    const box = boxes.get(node.id)!
    return {
      ...node,
      position: { x: box.x, y: box.y },
      initialWidth: box.width,
      initialHeight: box.height,
    } as PartNode
  })

  const groupNodes: MessageGroupNode[] = []
  for (const group of groups) {
    const members = group.partIds
      .map((id) => boxes.get(id))
      .filter((b): b is Box => b != null)
    if (members.length === 0) continue
    const minX = Math.min(...members.map((b) => b.x))
    const minY = Math.min(...members.map((b) => b.y))
    const maxX = Math.max(...members.map((b) => b.x + b.width))
    const maxY = Math.max(...members.map((b) => b.y + b.height))
    groupNodes.push({
      id: groupNodeId(group.messageIndex),
      type: "messageGroup",
      position: {
        x: minX - groupPadding,
        y: minY - groupPadding - groupHeader,
      },
      width: maxX - minX + groupPadding * 2,
      height: maxY - minY + groupPadding * 2 + groupHeader,
      data: group,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      zIndex: -1,
    })
  }

  // In spine mode the conversation column chains directly: a flow edge that
  // would leave a tool answer (two columns out) towards the next spine node
  // is drawn from the step's spine node instead, so tool branches stay local.
  const chained: TurnMapEdge[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    let e = edge
    if (spine && edge.data?.kind === "flow" && spine.spineOf.has(edge.source)) {
      const from = spine.spineOf.get(edge.source)
      if (!from || from === edge.target) continue
      e = { ...edge, id: `e:${from}:${edge.target}`, source: from }
    }
    if (seen.has(e.id)) continue
    seen.add(e.id)
    chained.push(e)
  }

  const routed = chained.map((edge) => {
    const from = boxes.get(edge.source)
    const to = boxes.get(edge.target)
    return from && to ? assignHandles(edge, from, to) : edge
  })

  // Groups first so they paint underneath their parts.
  return { nodes: [...groupNodes, ...positioned], edges: routed }
}
