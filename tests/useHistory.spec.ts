import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHistory } from '@/composables/useHistory'

describe('useHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pushes debounced state updates', () => {
    const history = useHistory({ debounceMs: 50 })
    history.init('one')

    history.pushState('two')
    expect(history.canUndo.value).toBe(false)

    vi.advanceTimersByTime(50)

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()?.markdown).toBe('one')
  })

  it('pushImmediate clears redo history', () => {
    const history = useHistory()
    history.init('one')
    history.pushImmediate('two')
    history.pushImmediate('three')

    expect(history.undo()?.markdown).toBe('two')
    expect(history.canRedo.value).toBe(true)

    history.pushImmediate('four')

    expect(history.canRedo.value).toBe(false)
  })

  it('does not push duplicate states', () => {
    const history = useHistory()
    history.init('one')

    history.pushImmediate('one')

    expect(history.canUndo.value).toBe(false)
  })

  it('clear resets both stacks and pending debounce', () => {
    const history = useHistory({ debounceMs: 50 })
    history.init('one')
    history.pushState('two')
    history.clear()

    vi.advanceTimersByTime(50)

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)
  })
})
