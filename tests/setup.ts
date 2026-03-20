import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})
