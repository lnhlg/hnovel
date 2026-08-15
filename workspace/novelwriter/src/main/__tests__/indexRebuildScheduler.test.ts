import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRebuildScheduler } from '../indexRebuildScheduler'

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

describe('createRebuildScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('安静期内多次 schedule 合并为一次重建', async () => {
    const run = vi.fn(async () => {})
    const s = createRebuildScheduler(run, 2000)

    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(500)
    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(500)
    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(2500)

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('重建进行中的新请求只补跑一轮（合并）', async () => {
    const gate = deferred()
    const run = vi.fn(() => gate.promise)
    const s = createRebuildScheduler(run, 2000)

    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(2000) // 第一轮开始执行
    expect(run).toHaveBeenCalledTimes(1)

    s.schedule('p1') // 执行中连发三次请求
    s.schedule('p1')
    s.schedule('p1')

    gate.resolve()
    await vi.advanceTimersByTimeAsync(0)
    await flushMicrotasks()

    expect(run).toHaveBeenCalledTimes(2) // 只补跑一轮
    expect(s.hasPending()).toBe(false)
  })

  it('flushPending 立即执行挂起任务并等待完成', async () => {
    const run = vi.fn(async () => {})
    const s = createRebuildScheduler(run, 2000)

    s.schedule('p1')
    expect(s.hasPending()).toBe(true)

    await s.flushPending()

    expect(run).toHaveBeenCalledTimes(1)
    expect(s.hasPending()).toBe(false)
  })

  it('flushPending 等待进行中的重建完成', async () => {
    const gate = deferred()
    const run = vi.fn(() => gate.promise)
    const s = createRebuildScheduler(run, 2000)

    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(2000) // 重建进行中
    expect(run).toHaveBeenCalledTimes(1)

    let flushed = false
    const flushing = s.flushPending().then(() => {
      flushed = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(flushed).toBe(false)

    gate.resolve()
    await flushMicrotasks()
    await flushing

    expect(flushed).toBe(true)
    expect(s.hasPending()).toBe(false)
  })

  it('不同项目互不影响', async () => {
    const run = vi.fn(async () => {})
    const s = createRebuildScheduler(run, 2000)

    s.schedule('p1')
    s.schedule('p2')
    await vi.advanceTimersByTimeAsync(2500)

    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenCalledWith('p1')
    expect(run).toHaveBeenCalledWith('p2')
  })

  it('run 抛错不破坏后续调度', async () => {
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })
    const s = createRebuildScheduler(failing, 2000)

    s.schedule('p1')
    await vi.advanceTimersByTimeAsync(2000)
    await flushMicrotasks()
    expect(failing).toHaveBeenCalledTimes(1)
    expect(s.hasPending()).toBe(false)

    // 失败后再次调度仍能正常执行
    s.schedule('p1')
    await s.flushPending()
    expect(failing).toHaveBeenCalledTimes(2)
    expect(s.hasPending()).toBe(false)
  })
})
