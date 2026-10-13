import type { NodeTypes } from "@xyflow/react"

import { MessageGroupView } from "./group-node"
import {
  MediaNodeView,
  NoteNodeView,
  PromptNodeView,
  ResponseNodeView,
  RetryNodeView,
  ThinkingNodeView,
  ToolCallNodeView,
  ToolReturnNodeView,
  UnknownNodeView,
} from "./part-nodes"

/** Node type map for React Flow. Stable module-level object. */
export const nodeTypes: NodeTypes = {
  prompt: PromptNodeView,
  response: ResponseNodeView,
  thinking: ThinkingNodeView,
  toolCall: ToolCallNodeView,
  toolReturn: ToolReturnNodeView,
  retry: RetryNodeView,
  media: MediaNodeView,
  note: NoteNodeView,
  unknown: UnknownNodeView,
  messageGroup: MessageGroupView,
}

export {
  MessageGroupView,
  MediaNodeView,
  NoteNodeView,
  PromptNodeView,
  ResponseNodeView,
  RetryNodeView,
  ThinkingNodeView,
  ToolCallNodeView,
  ToolReturnNodeView,
  UnknownNodeView,
}
