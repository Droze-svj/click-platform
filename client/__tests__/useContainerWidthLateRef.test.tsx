/**
 * Pages render a loading skeleton first and attach the measured element later.
 * The hook used to observe only on mount, so width stayed 0 forever and the
 * Settings page never switched to its phone layout.
 */
import React, { useState } from 'react'
import { render, act } from '@testing-library/react'
import { useContainerWidth } from '../hooks/useContainerWidth'

let observed: Element[] = []
let fire: (w: number) => void = () => {}
beforeAll(() => {
  ;(global as any).ResizeObserver = class {
    cb: any
    constructor(cb: any) { this.cb = cb; fire = (w) => this.cb([{ contentRect: { width: w } }]) }
    observe(el: Element) { observed.push(el) }
    disconnect() {}
  }
})

function Page({ loading }: { loading: boolean }) {
  const { ref, width } = useContainerWidth<HTMLDivElement>()
  if (loading) return <p>loading</p>
  return <div ref={ref} data-testid="shell">{width}</div>
}

it('measures an element that appears after a loading state', async () => {
  observed = []
  const { rerender, getByTestId } = render(<Page loading />)
  expect(observed).toHaveLength(0)
  rerender(<Page loading={false} />)
  expect(observed).toHaveLength(1)
  await act(async () => { fire(390) })
  expect(getByTestId('shell').textContent).toBe('390')
})
