import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react"

import { ACCENTS } from "./accents"
import { cn } from "./cn"
import { TurnMapContext, type TurnMapSettings } from "./context"
import {
  buildGraph,
  type PartNode,
  type TurnMapEdge,
  type TurnMapGraph,
  type TurnMapNode,
} from "./graph"
import { layoutGraph, type Direction, type LayoutMode } from "./layout"
import { NodeNav } from "./nav"
import { nodeTypes } from "./nodes"
import { paletteStyle, type Palette } from "./palette"
import { SidePanel, type PanelSide } from "./panel"
import { parseMessages, TurnMapParseError } from "./parse"
import type { ModelMessage } from "./schema"

export type TurnMapTheme = "light" | "dark" | "system"

export interface TurnMapProps {
  /**
   * The message history: the parsed `all_messages_json()` array, the raw JSON
   * string, or any of the wrapped shapes `parseMessages` accepts. A new value
   * renders a new graph, which is how consumers switch between sessions.
   */
  messages: unknown
  /**
   * `spine` (default): prompts and responses in a center column, tool calls
   * to the right, their returns further right. `TB` / `LR`: dagre top-down
   * or left-right.
   */
  layout?: LayoutMode
  /** @deprecated use `layout`. */
  direction?: Direction
  /** Color theme; `system` follows `prefers-color-scheme`. */
  theme?: TurnMapTheme
  /** Accent colors per node family; unspecified keys keep the defaults. */
  palette?: Palette
  /** Characters above which a tool return starts collapsed. */
  collapseThreshold?: number
  /** Open every node's details by default (else header and summary only). */
  expandNodes?: boolean
  showMinimap?: boolean
  showControls?: boolean
  showBackground?: boolean
  /** Prev / next / first / last control in the top-right corner (also arrow keys, Home, End). */
  showNavigation?: boolean
  fitViewPadding?: number
  /** Called when a part node is clicked. Group boxes are not selectable. */
  onSelect?: (node: PartNode) => void
  className?: string
  style?: CSSProperties
}

const MINIMAP_COLORS: Record<string, string> = {
  prompt: ACCENTS.user,
  response: ACCENTS.response,
  thinking: ACCENTS.thinking,
  toolCall: ACCENTS.toolCall,
  toolReturn: ACCENTS.toolReturn,
  retry: ACCENTS.retry,
  media: ACCENTS.media,
  note: ACCENTS.note,
  unknown: ACCENTS.unknown,
}

function minimapColor(node: { type?: string }) {
  if (node.type === "messageGroup") return "transparent"
  return MINIMAP_COLORS[node.type ?? ""] ?? ACCENTS.unknown
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

function subscribeSystemDark(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function readSystemDark() {
  return (
    typeof window !== "undefined" && !!window.matchMedia?.(DARK_QUERY).matches
  )
}

function useDark(theme: TurnMapTheme): boolean {
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    readSystemDark,
    () => false
  )
  return theme === "dark" ? true : theme === "light" ? false : systemDark
}

interface Prepared {
  graph: TurnMapGraph | null
  warnings: string[]
  error: string | null
}

function prepare(messages: unknown): Prepared {
  try {
    const { messages: parsed, warnings } = parseMessages(messages)
    return {
      graph: buildGraph(parsed as ModelMessage[]),
      warnings,
      error: null,
    }
  } catch (error) {
    const message =
      error instanceof TurnMapParseError
        ? error.message
        : `Could not read the message history: ${(error as Error).message}`
    return { graph: null, warnings: [], error: message }
  }
}

/**
 * Renders a pydantic-ai message history as an interactive graph. Fills its
 * container, so give the parent a height.
 */
export function TurnMap({
  messages,
  layout,
  direction,
  theme = "system",
  palette,
  collapseThreshold = 600,
  expandNodes = false,
  showMinimap = true,
  showControls = true,
  showBackground = true,
  showNavigation = true,
  fitViewPadding = 0.15,
  onSelect,
  className,
  style,
}: TurnMapProps) {
  const mode: LayoutMode = layout ?? direction ?? "spine"
  const dark = useDark(theme)
  const prepared = useMemo(() => prepare(messages), [messages])
  const colors = useMemo(() => paletteStyle(palette), [palette])

  return (
    <div
      className={cn("turnmap", dark && "dark", className)}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...colors,
        ...style,
      }}
      data-theme={dark ? "dark" : "light"}
    >
      {prepared.error ? (
        <div className="tm:flex tm:h-full tm:items-center tm:justify-center tm:p-6 tm:text-center tm:text-sm tm:text-accent-retry">
          {prepared.error}
        </div>
      ) : (
        // Remount per history so canvas state and the measured layout pass
        // start fresh for each session.
        <ReactFlowProvider key={graphKey(prepared.graph!)}>
          <Canvas
            graph={prepared.graph!}
            mode={mode}
            dark={dark}
            collapseThreshold={collapseThreshold}
            expandNodes={expandNodes}
            showMinimap={showMinimap}
            showControls={showControls}
            showBackground={showBackground}
            showNavigation={showNavigation}
            fitViewPadding={fitViewPadding}
            onSelect={onSelect}
          />
        </ReactFlowProvider>
      )}
    </div>
  )
}

const keys = new WeakMap<TurnMapGraph, number>()
let nextKey = 0
function graphKey(graph: TurnMapGraph): number {
  let k = keys.get(graph)
  if (k == null) {
    k = nextKey++
    keys.set(graph, k)
  }
  return k
}

interface CanvasProps {
  graph: TurnMapGraph
  mode: LayoutMode
  dark: boolean
  collapseThreshold: number
  expandNodes: boolean
  showMinimap: boolean
  showControls: boolean
  showBackground: boolean
  showNavigation: boolean
  fitViewPadding: number
  onSelect?: (node: PartNode) => void
}

const PANEL_WIDTH = 420

function Canvas({
  graph,
  mode,
  dark,
  collapseThreshold,
  expandNodes,
  showMinimap,
  showControls,
  showBackground,
  showNavigation,
  fitViewPadding,
  onSelect,
}: CanvasProps) {
  const initial = useMemo(
    () =>
      layoutGraph(graph.nodes, graph.edges, graph.groups, { mode: "spine" }),
    [graph]
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<TurnMapNode>(
    initial.nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<TurnMapEdge>(
    initial.edges
  )
  const {
    getNodes,
    getNode,
    fitView,
    setCenter,
    getZoom,
    getViewport,
    setViewport,
    flowToScreenPosition,
  } = useReactFlow<TurnMapNode, TurnMapEdge>()
  const containerRef = useRef<HTMLDivElement>(null)
  // Layout mode the view was last fitted for; a switch refits once.
  const fittedFor = useRef<LayoutMode | null>(null)

  // Navigation order: part nodes in message / part order.
  const order = useMemo(() => graph.nodes.map((n) => n.id), [graph])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [panel, setPanel] = useState<{ id: string; side: PanelSide } | null>(
    null
  )
  const activeIndex = activeId ? order.indexOf(activeId) : -1

  // React Flow reports each node's DOM size through `measured`. Whenever the
  // set of measured sizes changes (first measurement, an expanded block, a
  // layout switch), run the layout again with the real sizes. The signature
  // only reflects sizes, so repositioning never re-triggers it.
  const sizeSignature = useMemo(
    () =>
      nodes
        .filter((n) => n.type !== "messageGroup")
        .map(
          (n) =>
            `${n.id}:${n.measured?.width ?? ""}x${n.measured?.height ?? ""}`
        )
        .join("|"),
    [nodes]
  )

  useEffect(() => {
    const current = getNodes()
    const sizes = new Map<string, { width: number; height: number }>()
    for (const n of current) {
      if (n.type === "messageGroup") continue
      if (!n.measured?.width || !n.measured?.height) return
      sizes.set(n.id, { width: n.measured.width, height: n.measured.height })
    }
    const parts = current.filter((n) => n.type !== "messageGroup") as PartNode[]
    const frame = requestAnimationFrame(() => {
      const result = layoutGraph(parts, graph.edges, graph.groups, {
        mode,
        sizes,
      })
      setNodes(result.nodes)
      setEdges(result.edges)
      if (fittedFor.current !== mode) {
        fittedFor.current = mode
        requestAnimationFrame(() => {
          void fitView({ padding: fitViewPadding })
        })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [
    sizeSignature,
    mode,
    graph,
    getNodes,
    setNodes,
    setEdges,
    fitView,
    fitViewPadding,
  ])

  /** Center the viewport on a node, keeping the zoom. */
  const centerOn = useCallback(
    (id: string) => {
      const node = getNode(id)
      if (!node) return
      const w = node.measured?.width ?? node.initialWidth ?? 0
      const h = node.measured?.height ?? node.initialHeight ?? 0
      void setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: getZoom(),
        duration: 250,
      })
    },
    [getNode, setCenter, getZoom]
  )

  /** Screen-space box of a node relative to the container. */
  const nodeBox = useCallback(
    (id: string) => {
      const node = getNode(id)
      const rect = containerRef.current?.getBoundingClientRect()
      if (!node || !rect) return null
      const w = node.measured?.width ?? node.initialWidth ?? 0
      const h = node.measured?.height ?? node.initialHeight ?? 0
      const tl = flowToScreenPosition({
        x: node.position.x,
        y: node.position.y,
      })
      const br = flowToScreenPosition({
        x: node.position.x + w,
        y: node.position.y + h,
      })
      return {
        left: tl.x - rect.left,
        right: br.x - rect.left,
        top: tl.y - rect.top,
        bottom: br.y - rect.top,
        width: rect.width,
        height: rect.height,
      }
    },
    [getNode, flowToScreenPosition]
  )

  /**
   * Open the panel on the side away from the node (a node on the left half
   * gets the panel on the right), then pan the node clear if the panel
   * would still cover it.
   */
  const openNode = useCallback(
    (id: string) => {
      setActiveId(id)
      const box = nodeBox(id)
      const side: PanelSide =
        box && (box.left + box.right) / 2 > box.width / 2 ? "left" : "right"
      setPanel({ id, side })
      if (!box) return
      const panelWidth = Math.min(PANEL_WIDTH, box.width * 0.92)
      const margin = 16
      let dx = 0
      if (side === "right" && box.right > box.width - panelWidth - margin) {
        dx = box.width - panelWidth - margin - box.right
      } else if (side === "left" && box.left < panelWidth + margin) {
        dx = panelWidth + margin - box.left
      }
      if (dx !== 0) {
        const vp = getViewport()
        void setViewport({ ...vp, x: vp.x + dx }, { duration: 250 })
      }
    },
    [nodeBox, getViewport, setViewport]
  )

  const goTo = useCallback(
    (index: number) => {
      const id = order[Math.max(0, Math.min(order.length - 1, index))]
      if (!id) return
      setActiveId(id)
      centerOn(id)
      setPanel((p) => (p ? { ...p, id } : p))
    },
    [order, centerOn]
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (order.length === 0) return
    const target = event.target as HTMLElement
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    )
      return
    let handled = true
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        goTo(activeIndex < 0 ? 0 : activeIndex + 1)
        break
      case "ArrowUp":
      case "ArrowLeft":
        goTo(activeIndex < 0 ? 0 : activeIndex - 1)
        break
      case "Home":
        goTo(0)
        break
      case "End":
        goTo(order.length - 1)
        break
      case "Enter":
        if (activeId) openNode(activeId)
        break
      case "Escape":
        setPanel(null)
        break
      default:
        handled = false
    }
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const onNodeClick: NodeMouseHandler<TurnMapNode> = (_event, node) => {
    if (node.type === "messageGroup") return
    setActiveId(node.id)
    onSelect?.(node as PartNode)
  }

  const settings = useMemo<TurnMapSettings>(
    () => ({ collapseThreshold, dark, expandNodes, activeId, openNode }),
    [collapseThreshold, dark, expandNodes, activeId, openNode]
  )

  const panelNode = panel
    ? (graph.nodes.find((n) => n.id === panel.id) ?? null)
    : null
  const panelGroup = panelNode
    ? graph.groups.find((g) => g.messageIndex === panelNode.data.messageIndex)
    : undefined

  return (
    <TurnMapContext.Provider value={settings}>
      <div
        ref={containerRef}
        className="tm:relative tm:h-full tm:w-full tm:outline-none"
        tabIndex={0}
        onKeyDownCapture={onKeyDown}
      >
        <ReactFlow<TurnMapNode, TurnMapEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          colorMode={dark ? "dark" : "light"}
          nodesConnectable={false}
          nodesDraggable={false}
          elevateNodesOnSelect={false}
          fitView
          fitViewOptions={{ padding: fitViewPadding }}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          {showBackground && (
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          )}
          {showControls && <Controls showInteractive={false} />}
          {showMinimap && (
            <MiniMap
              position="bottom-right"
              nodeColor={minimapColor}
              nodeStrokeWidth={2}
              pannable
              zoomable
            />
          )}
          {showNavigation && (
            <Panel position="top-right">
              <NodeNav
                index={activeIndex}
                total={order.length}
                onFirst={() => goTo(0)}
                onPrev={() => goTo(activeIndex < 0 ? 0 : activeIndex - 1)}
                onNext={() => goTo(activeIndex < 0 ? 0 : activeIndex + 1)}
                onLast={() => goTo(order.length - 1)}
              />
            </Panel>
          )}
        </ReactFlow>
        {panelNode && (
          <SidePanel
            node={panelNode}
            group={panelGroup}
            side={panel!.side}
            index={order.indexOf(panelNode.id)}
            total={order.length}
            onClose={() => setPanel(null)}
          />
        )}
      </div>
    </TurnMapContext.Provider>
  )
}
