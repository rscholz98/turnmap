import type { ReactNode } from "react"

import type { PartNode } from "../graph"
import { Section, Text } from "../panel"
import { stringify, truncateJson } from "../parse"
import { CodeBlock } from "./blocks"
import { formatBytes } from "./format"

/** Human title and the type-specific full content of a part node. */
export function describeNode(node: PartNode): {
  title: string
  content: ReactNode
} {
  switch (node.type) {
    case "prompt":
      return {
        title: node.data.role === "user" ? "User prompt" : "System prompt",
        content: (
          <>
            <Section title="Content">
              <Text text={node.data.text} />
            </Section>
            {node.data.attachments.length > 0 && (
              <Section
                title={`Attachments (${node.data.attachments.length})`}
                json={stringify(node.data.attachments)}
              >
                <CodeBlock
                  text={stringify(truncateJson(node.data.attachments))}
                  limit={Infinity}
                />
              </Section>
            )}
          </>
        ),
      }
    case "response":
      return {
        title: "Model response",
        content: (
          <Section title="Content">
            <Text text={node.data.text} />
          </Section>
        ),
      }
    case "thinking":
      return {
        title: node.data.variant === "compaction" ? "Compaction" : "Thinking",
        content: (
          <Section title="Content">
            <Text text={node.data.text} />
          </Section>
        ),
      }
    case "toolCall":
      return {
        title: `Tool call: ${node.data.toolName}`,
        content: (
          <Section
            title="Arguments"
            json={
              node.data.args == null ? undefined : stringify(node.data.args)
            }
          >
            {node.data.args == null ? (
              <p className="tm:m-0 tm:text-muted-foreground tm:italic">
                no arguments
              </p>
            ) : (
              <CodeBlock
                text={stringify(truncateJson(node.data.args))}
                limit={Infinity}
              />
            )}
          </Section>
        ),
      }
    case "toolReturn": {
      const text = stringify(node.data.content)
      return {
        title: `Tool return: ${node.data.toolName}`,
        content: (
          <>
            <Section title={`Output · ${formatBytes(text.length)}`} json={text}>
              <CodeBlock
                text={
                  typeof node.data.content === "string"
                    ? stringify(
                        truncateJson(node.data.content, { maxString: 2000 })
                      )
                    : stringify(truncateJson(node.data.content))
                }
                limit={Infinity}
              />
            </Section>
            {node.data.metadata != null && (
              <Section title="Metadata" json={stringify(node.data.metadata)}>
                <CodeBlock
                  text={stringify(node.data.metadata)}
                  limit={Infinity}
                />
              </Section>
            )}
          </>
        ),
      }
    }
    case "retry":
      return {
        title: node.data.toolName
          ? `Retry: ${node.data.toolName}`
          : "Retry: output validation",
        content: (
          <Section
            title={
              node.data.errors
                ? `Validation errors (${node.data.errors.length})`
                : "Message"
            }
          >
            {node.data.errors ? (
              <ul className="tm:m-0 tm:flex tm:list-none tm:flex-col tm:gap-1.5 tm:p-0">
                {node.data.errors.map((err, i) => (
                  <li
                    key={i}
                    className="tm:rounded-md tm:bg-accent-retry/10 tm:px-2 tm:py-1.5"
                  >
                    <div className="tm:font-mono tm:text-[11px] tm:text-accent-retry">
                      {err.loc?.length ? err.loc.join(".") : "(root)"} ·{" "}
                      {err.type}
                    </div>
                    <div className="tm:text-[12px]">{err.msg}</div>
                    {err.input !== undefined && (
                      <div className="tm:mt-1 tm:font-mono tm:text-[11px] tm:text-muted-foreground">
                        input: {stringify(err.input)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Text text={node.data.text ?? ""} />
            )}
          </Section>
        ),
      }
    case "media": {
      const d = node.data
      const isImage = d.mediaType?.startsWith("image/") && d.dataUrl
      const isAudio = d.mediaType?.startsWith("audio/") && d.dataUrl
      return {
        title:
          d.variant === "speech"
            ? `Speech (${d.speaker ?? "unknown"})`
            : "File",
        content: (
          <Section title="Media">
            {isImage && (
              <img
                src={d.dataUrl!}
                alt=""
                className="tm:max-w-full tm:rounded-md"
              />
            )}
            {isAudio && (
              <audio controls src={d.dataUrl!} className="tm:w-full" />
            )}
            {d.transcript && <Text text={d.transcript} />}
            {!isImage && !isAudio && !d.transcript && (
              <p className="tm:m-0 tm:text-muted-foreground">
                {d.mediaType ?? "binary"}
              </p>
            )}
          </Section>
        ),
      }
    }
    case "note":
      return {
        title: node.data.title,
        content: (
          <Section title="Tools">
            <ul className="tm:m-0 tm:pl-4">
              {node.data.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Section>
        ),
      }
    default:
      return { title: node.data.title, content: null }
  }
}
