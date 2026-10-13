import dagre from "@dagrejs/dagre"
import type { Edge } from "@xyflow/react"

import {
  groupNodeId,
  type MessageGroupData,
  type MessageGroupNode,
  type PartNode,
  type TurnMapNode,
} from "./graph"

export type Direction = "TB" | "LR"

export interface LayoutOptions {
  direction?: Direction
  /** Measured sizes by node id; falls back to `fallbackSize` per node type. */
  sizes?: Map<string, { width: number; height: number }>
  nodeSeparation?: number
  rankSeparation?: number
  /** Padding between a message group's border and its parts. */
  groupPadding?: number
  /** Extra room at the top of a group for its header. */
  groupHeader?: number
}

export const NODE_WIDTH = 320

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

/**
 * Position part nodes with dagre (top-down by default) and wrap each message's
 * parts in a decorative group node. Groups are computed after the layout from
 * the parts' bounding boxes, so dagre only ever sees the part graph.
 */
export function layoutGraph(
  nodes: PartNode[],
  edges: Edge[],
  groups: MessageGroupData[],
  options: LayoutOptions = {}
): TurnMapNode[] {
  const {
    direction = "TB",
    sizes,
    nodeSeparation = 48,
    rankSeparation = 100,
    groupPadding = 20,
    groupHeader = 36,
  } = options

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSeparation,
    ranksep: rankSeparation,
    marginx: 20,
    marginy: 20,
  })

  const sizeOf = (node: PartNode) =>
    sizes?.get(node.id) ?? fallbackSize(node.type)

  for (const node of nodes) {
    const { width, height } = sizeOf(node)
    g.setNode(node.id, { width, height })
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const positioned: PartNode[] = nodes.map((node) => {
    const { width, height } = sizeOf(node)
    const { x, y } = g.node(node.id)
    // `initialWidth` / `initialHeight` seed React Flow before measurement
    // without forcing the DOM size the way `width` / `height` would.
    return {
      ...node,
      position: { x: x - width / 2, y: y - height / 2 },
      initialWidth: width,
      initialHeight: height,
    } as PartNode
  })

  const byId = new Map(positioned.map((n) => [n.id, n]))
  const groupNodes: MessageGroupNode[] = []
  for (const group of groups) {
    const members = group.partIds
      .map((id) => byId.get(id))
      .filter((n): n is PartNode => n != null)
    if (members.length === 0) continue
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const m of members) {
      const w = m.initialWidth ?? NODE_WIDTH
      const h = m.initialHeight ?? fallbackSize(m.type).height
      minX = Math.min(minX, m.position.x)
      minY = Math.min(minY, m.position.y)
      maxX = Math.max(maxX, m.position.x + w)
      maxY = Math.max(maxY, m.position.y + h)
    }
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

  // Groups first so they paint underneath their parts.
  return [...groupNodes, ...positioned]
}
