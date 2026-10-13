import "@testing-library/jest-dom/vitest"

// React Flow measures nodes with ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver

// Node measurement reads layout boxes, which jsdom returns as zeros.
if (!Element.prototype.getBoundingClientRect.toString().includes("stub")) {
  Element.prototype.getBoundingClientRect = function stub() {
    return {
      x: 0,
      y: 0,
      width: 320,
      height: 120,
      top: 0,
      left: 0,
      right: 320,
      bottom: 120,
      toJSON() {},
    } as DOMRect
  }
}
