// 索引重建调度器（纯逻辑，无 electron/文件依赖，可独立单测）。
// 目标：保存/生成后的全量重建不立即执行，等 debounceMs 安静期；重建进行中的
// 新请求只标记一次"脏"，本轮结束后补跑一轮——避免频繁保存时反复全量重建。
export interface RebuildScheduler {
  /** 请求重建某项目（防抖 + 合并） */
  schedule: (projectId: string) => void
  /** 立即执行所有挂起的重建并等待完成（用于退出前兜底） */
  flushPending: () => Promise<void>
  /** 是否存在尚未完成的重建请求 */
  hasPending: () => boolean
}

export function createRebuildScheduler(
  run: (projectId: string) => Promise<void>,
  debounceMs = 2000
): RebuildScheduler {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  // 每个项目一条串行执行链：链存在即表示正在执行（或即将执行）重建
  const chains = new Map<string, Promise<void>>()
  // 链执行期间新到的请求，本轮结束后自动补跑一轮
  const dirty = new Set<string>()

  function startRun(projectId: string): Promise<void> {
    const runOnce = (async (): Promise<void> => {
      do {
        dirty.delete(projectId)
        await run(projectId)
      } while (dirty.has(projectId))
    })()
    return runOnce.catch((err) => {
      console.error('[index-rebuild] 索引重建失败:', projectId, err)
    })
  }

  function startChain(projectId: string): void {
    const chain = startRun(projectId)
    chains.set(projectId, chain)
    void chain.finally(() => {
      if (chains.get(projectId) === chain) chains.delete(projectId)
    })
  }

  function schedule(projectId: string): void {
    if (chains.has(projectId)) {
      // 已有执行链（运行中），标记脏即可，链会自行补跑
      dirty.add(projectId)
      return
    }
    const prev = timers.get(projectId)
    if (prev) clearTimeout(prev)
    timers.set(
      projectId,
      setTimeout(() => {
        timers.delete(projectId)
        startChain(projectId)
      }, debounceMs)
    )
  }

  async function flushPending(): Promise<void> {
    const timerIds = [...timers.keys()]
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()

    // 已有执行链（含脏标记的补跑）等待其自然完成；仅挂定时器的项目立即起链
    const runs: Promise<void>[] = [...chains.keys()].map((id) => chains.get(id)!)
    for (const id of timerIds) {
      if (!chains.has(id)) {
        startChain(id)
        runs.push(chains.get(id)!)
      }
    }
    await Promise.all(runs)
  }

  function hasPending(): boolean {
    return timers.size > 0 || chains.size > 0
  }

  return { schedule, flushPending, hasPending }
}
