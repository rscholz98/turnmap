import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TurnMap } from "../src/turn-map"
import { FIXTURES } from "./fixtures"

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
      screen.getAllByText(/Retry: output validation/).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Input should be less than or equal to 12/).length
    ).toBeGreaterThan(0)
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
    fireEvent.keyDown(canvas, { key: "ArrowUp" })
    expect(counter()).toContain("4 / 5")
    fireEvent.keyDown(canvas, { key: "Home" })
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
    fireEvent.click(
      screen.getAllByRole("button", { name: "Open in side panel" })[2]
    )
    const panel = screen.getByRole("dialog")
    expect(panel).toHaveAttribute("aria-label", "Tool call: get_order")
    expect(panel.textContent).toContain("Arguments")
    expect(panel.textContent).toContain("tool call id")
    const canvas = container.querySelector("[tabindex='0']") as HTMLElement
    fireEvent.keyDown(canvas, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
