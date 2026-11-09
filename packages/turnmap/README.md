# turnmap

React component that renders a [Pydantic AI](https://ai.pydantic.dev) message history
(`result.all_messages_json()`) as an interactive graph: prompts, model responses, thinking,
tool calls, tool returns and validation retries as nodes, laid out top-down with dagre,
grouped by message. Runs entirely in the browser.

`messages` also takes a stored `Conversation` (`ConversationTypeAdapter.dump_json(...)`) or a
`ConversationStore`'s entries: the graph then shows the conversation's running usage, the
tool calls a paused run is waiting on, each message's entry id, and a switch between the
current history and the branches the store kept.

Try it at [turnmap.dev](https://turnmap.dev).

```bash
npm install turnmap
```

```tsx
import { TurnMap } from "turnmap"
import "turnmap/styles.css"

;<div style={{ height: "80vh" }}>
  <TurnMap messages={history} theme="system" />
</div>
```

Switch sessions by rendering a different `messages` value. Full docs, props and the
lower-level `parseMessages` / `buildGraph` / `layoutGraph` API:
[github.com/rscholz98/turnmap](https://github.com/rscholz98/turnmap#readme).

MIT
