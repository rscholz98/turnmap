import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TurnMap } from "../src/turn-map"
import {
  FIXTURES,
  LEGACY_RETRY,
  PAUSED_CONVERSATION,
  STORED_CONVERSATION,
} from "./fixtures"

describe("TurnMap", () => {
  it("renders every fixture", () => {
    for (const [name, data] of Object.entries(FIXTURES)) {
      const { container, unmount } = render(
        <div style={{ width: 800, height: 600 }}>
          <TurnMap messages={data} theme="light" />
        </div>
      )
      expect(container.querySelector(".turnmap"), name).not.toBeNull()
      expect(container.querySelector(".react-flow"), name).not.toBeNull()
      unmount()
    }
  })

  it("shows node content for the retry fixture", () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={FIXTURES.retry} theme="light" />
      </div>
    )
    expect(screen.getAllByText(/Retry: book_table/).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Retry: output rejected/).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Input should be less than or equal to 12/).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByTitle("attempt 1 of 3")).toHaveLength(2)
    expect(screen.queryByText("retried")).toBeNull()
  })

  it("shows the retries of a history stored before pydantic-ai 2.60", () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={LEGACY_RETRY} theme="light" />
      </div>
    )
    expect(screen.getAllByText(/Retry: book_table/).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Retry: output validation/).length
    ).toBeGreaterThan(0)
    expect(screen.queryByTitle(/attempt/)).toBeNull()
  })

  it("renders a readable error for bad input", () => {
    render(<TurnMap messages="{oops" theme="light" />)
    expect(screen.getByText(/not valid JSON/)).toBeInTheDocument()
  })

  it("applies the dark class when theme is dark", () => {
    const { container } = render(
      <TurnMap messages={FIXTURES["simple-chat"]} theme="dark" />
    )
    expect(container.querySelector(".turnmap.dark")).not.toBeNull()
  })
})

describe("navigation and side panel", () => {
  it("steps through nodes with the control and the arrow keys", async () => {
    const { fireEvent } = await import("@testing-library/react")
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={FIXTURES["simple-chat"]} theme="light" />
      </div>
    )
    const counter = () =>
      screen.getByRole("group", { name: "Node navigation" }).textContent
    expect(counter()).toContain("– / 5")
    fireEvent.click(screen.getByRole("button", { name: /Next node/ }))
    expect(counter()).toContain("1 / 5")
    fireEvent.click(screen.getByRole("button", { name: /Last node/ }))
    expect(counter()).toContain("5 / 5")
    const canvas = container.querySelector("[tabindex='0']") as HTMLElement
    fireEvent.keyDown(canvas, { key: "Home" })
    expect(counter()).toContain("1 / 5")
    // Spatial: the user prompt sits directly below the system prompt.
    fireEvent.keyDown(canvas, { key: "ArrowDown" })
    expect(counter()).toContain("2 / 5")
    fireEvent.keyDown(canvas, { key: "ArrowUp" })
    expect(counter()).toContain("1 / 5")
    expect(container.querySelector(".tm-node-active")).not.toBeNull()
  })

  it("opens the side panel from a node and closes it with Escape", async () => {
    const { fireEvent } = await import("@testing-library/react")
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={FIXTURES["tool-calls"]} theme="light" />
      </div>
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getAllByRole("button", { name: "get_order" })[0])
    const panel = screen.getByRole("dialog")
    expect(panel).toHaveAttribute("aria-label", "Tool call: get_order")
    expect(panel.textContent).toContain("Arguments")
    expect(panel.textContent).toContain("tool call id")
    const canvas = container.querySelector("[tabindex='0']") as HTMLElement
    fireEvent.keyDown(canvas, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("conversations", () => {
  it("draws no conversation bar for a plain message history", () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={FIXTURES["simple-chat"]} theme="light" />
      </div>
    )
    expect(screen.queryByRole("group", { name: "Conversation" })).toBeNull()
  })

  it("shows what a paused conversation carries and what its calls wait on", () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={PAUSED_CONVERSATION} theme="light" />
      </div>
    )
    const bar = screen.getByRole("group", { name: "Conversation" })
    expect(bar.textContent).toContain("returns-a-1042")
    expect(bar.textContent).toContain("2 requests")
    expect(bar.textContent).toContain("1 tool call")
    expect(bar.textContent).toContain("paused: 1 approval, 1 external result")
    expect(screen.queryByRole("combobox", { name: "Branch" })).toBeNull()
    expect(screen.getByText("needs approval")).toBeInTheDocument()
    expect(screen.getByText("awaits result")).toBeInTheDocument()
  })

  it("hides the bar with showConversation={false}", () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap
          messages={PAUSED_CONVERSATION}
          theme="light"
          showConversation={false}
        />
      </div>
    )
    expect(screen.queryByRole("group", { name: "Conversation" })).toBeNull()
    expect(screen.getByText("needs approval")).toBeInTheDocument()
  })

  it("switches between a stored conversation's current history and a branch", async () => {
    const { fireEvent } = await import("@testing-library/react")
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={STORED_CONVERSATION} theme="light" />
      </div>
    )
    const counter = () =>
      screen.getByRole("group", { name: "Node navigation" }).textContent
    // Current history: system + user, then five single-part messages.
    expect(counter()).toContain("– / 7")
    expect(screen.getByText("1 branch")).toBeInTheDocument()
    const select = screen.getByRole("combobox", { name: "Branch" })
    expect(select.textContent).toContain("Current history · 6 messages")
    expect(select.textContent).toContain(
      "Branch 1 · left after message 2 · 4 messages"
    )
    fireEvent.change(select, {
      target: { value: STORED_CONVERSATION.record.branches[0] },
    })
    expect(counter()).toContain("– / 5")
    expect(screen.getByText("1 branch")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox", { name: "Branch" }), {
      target: { value: "" },
    })
    expect(counter()).toContain("– / 7")
  })

  it("shows a message's store entry id in the side panel", async () => {
    const { fireEvent } = await import("@testing-library/react")
    render(
      <div style={{ width: 800, height: 600 }}>
        <TurnMap messages={STORED_CONVERSATION} theme="light" />
      </div>
    )
    fireEvent.click(screen.getAllByRole("button", { name: /System prompt/ })[0])
    const panel = screen.getByRole("dialog")
    expect(panel.textContent).toContain("entry id")
    expect(panel.textContent).toContain(STORED_CONVERSATION.entries[0].id)
  })
})
