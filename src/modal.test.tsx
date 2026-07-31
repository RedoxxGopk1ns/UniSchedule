// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Modal } from './components/ui/Modal'

/**
 * The §15 focus contract. Regression cover for a modal that focused its own
 * panel instead of the first control: the old code read
 * `first?.focus() ?? panel?.focus()`, and because focus() returns undefined the
 * right-hand side always ran and took focus straight back.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('Modal focus', () => {
  it('moves focus to the first focusable control on open', () => {
    act(() => {
      root.render(
        <Modal open onClose={() => {}} labelledBy="t">
          <h2 id="t">Title</h2>
          <button type="button" id="first">
            First
          </button>
          <button type="button" id="second">
            Second
          </button>
        </Modal>,
      )
    })

    expect(document.activeElement?.id).toBe('first')
  })

  it('falls back to the panel when there is nothing focusable inside', () => {
    act(() => {
      root.render(
        <Modal open onClose={() => {}} labelledBy="t">
          <h2 id="t">Title</h2>
          <p>Nothing to focus here.</p>
        </Modal>,
      )
    })

    expect(document.activeElement?.tagName).toBe('DIV')
    expect(container.contains(document.activeElement)).toBe(true)
  })
})
