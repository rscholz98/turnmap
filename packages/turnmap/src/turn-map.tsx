import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react"
import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react"

import { ACCENTS } from "./accents"
import { cn } from "./cn"
import { TurnMapContext } from "./context"
import {
  buildGraph,
  type PartNode,
  type TurnMapEdge,
  type TurnMapGraph,
  type TurnMapNode,
} from "./graph"
import { layoutGraph, type Direction, type LayoutMode } from "./layout"
import { nodeTypes } from "./nodes"
import { paletteStyle, type Palette } from "./palette"
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
  showMinimap?: boolean
  showControls?: boolean
  showBackground?: boolean
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
  showMinimap = true,
  showControls = true,
  showBackground = true,
  fitViewPadding = 0.15,
  onSelect,
  className,
  style,
}: TurnMapProps) {
  const mode: LayoutMode = layout ?? direction ?? "spine"
  const dark = useDark(theme)
  const prepared = useMemo(() => prepare(messages), [messages])
  const settings = useMemo(
    () => ({ collapseThreshold, dark }),
    [collapseThreshold, dark]
  )
  const colors = useMemo(() => paletteStyle(palette), [palette])

  return (
    <div
      className={cn("turnmap", dark && "dark", className)}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        ...colors,
        ...style,
      }}
      data-theme={dark ? "dark" : "light"}
    >
      <TurnMapContext.Provider value={settings}>
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
              showMinimap={showMinimap}
              showControls={showControls}
              showBackground={showBackground}
              fitViewPadding={fitViewPadding}
              onSelect={onSelect}
            />
          </ReactFlowProvider>
        )}
      </TurnMapContext.Provider>
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
  showMinimap: boolean
  showControls: boolean
  showBackground: boolean
  fitViewPadding: number
  onSelect?: (node: PartNode) => void
}

function Canvas({
  graph,
  mode,
  dark,
  showMinimap,
  showControls,
  showBackground,
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
  const { getNodes, fitView } = useReactFlow<TurnMapNode, TurnMapEdge>()
  // Layout mode the view was last fitted for; a switch refits once.
  const fittedFor = useRef<LayoutMode | null>(null)

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

  const onNodeClick: NodeMouseHandler<TurnMapNode> = (_event, node) => {
    if (node.type !== "messageGroup") onSelect?.(node as PartNode)
  }

  return (
    <ReactFlow<TurnMapNode, TurnMapEdge>
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onSelect ? onNodeClick : undefined}
      nodeTypes={nodeTypes}
      colorMode={dark ? "dark" : "light"}
      nodesConnectable={false}
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
    </ReactFlow>
  )
}
