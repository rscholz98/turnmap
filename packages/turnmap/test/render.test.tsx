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
