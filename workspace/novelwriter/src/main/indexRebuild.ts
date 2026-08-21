import { join } from 'path'
import { loadProjectById } from './fileStorage'
import { openIndex, saveIndex, clearSearchDocs, insertSearchDocs } from './indexStore'
import { collectIndexableDocs } from './indexDocs'
import { createRebuildScheduler } from './indexRebuildScheduler'

// 每批插入的文档数；批次之间让出事件循环，重建期间主进程 IPC 保持响应
const INSERT_BATCH_SIZE = 100

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

// ===== 同一项目索引写入串行化 =====
// 调度器重建、手动 index:rebuild、搜索路径"空索引现场重建"可能并发，
// 各自持有独立的 sql.js 连接写同一个 index.db，互斥避免互相覆盖。
const projectQueues = new Map<string, Promise<void>>()

function runExclusive<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = projectQueues.get(projectId) ?? Promise.resolve()
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  // 链尾 promise 永远 resolve（吞掉前序错误），下一个调用者等待 gate 放行
  projectQueues.set(projectId, prev.then(() => gate).catch(() => {}))
  return prev.then(async () => {
    try {
      return await fn()
    } finally {
      release()
    }
  })
}

async function rebuildProjectIndexCore(
  projectId: string,
  cooperative: boolean
): Promise<{ success: boolean; count: number }> {
  return runExclusive(projectId, async () => {
    const project = loadProjectById(projectId)
    if (!project?.path) return { success: false, count: 0 }
    const dbPath = join(project.path, '.novelwriter', 'index.db')
    const db = await openIndex(dbPath)
    const startedAt = Date.now()
    try {
      const docs = collectIndexableDocs(project.path)
      clearSearchDocs(db)
      for (let i = 0; i < docs.length; i += INSERT_BATCH_SIZE) {
        insertSearchDocs(db, docs.slice(i, i + INSERT_BATCH_SIZE))
        if (cooperative && i + INSERT_BATCH_SIZE < docs.length) {
          await yieldToEventLoop()
        }
      }
      saveIndex(db, dbPath)
      // 量级警戒：全量 LIKE 扫描重建随文档量线性增长，超阈值时提示（见 docs/analysis/01-storage-layer.md R2）
      const elapsed = Date.now() - startedAt
      if (elapsed > 2000) {
        console.warn(`[index-rebuild] 项目「${project.name}」重建耗时 ${elapsed}ms（${docs.length} 个文档），文档量增长后请评估 FTS5/增量方案（ADR 0004）`)
      }
      return { success: true, count: docs.length }
    } finally {
      db.close()
    }
  })
}

/**
 * 从书稿目录全量重建项目索引。
 * 分批插入并在批次间让出事件循环（约 100 文档让出一次），
 * 避免保存章节/生成内容后主进程被长时间同步阻塞、IPC 全部排队。
 */
export async function rebuildProjectIndex(
  projectId: string
): Promise<{ success: boolean; count: number }> {
  return rebuildProjectIndexCore(projectId, true)
}

// ===================== 防抖 + 合并调度（默认实例） =====================

const defaultScheduler = createRebuildScheduler(async (projectId) => {
  const result = await rebuildProjectIndex(projectId)
  if (!result.success) {
    console.warn('[index-rebuild] 项目不存在或未设置路径，跳过索引重建:', projectId)
  }
})

/** 保存/生成内容后调用：防抖地重建搜索索引（索引允许滞后，退出前由 flush 兜底） */
export function scheduleProjectIndexRebuild(projectId: string): void {
  defaultScheduler.schedule(projectId)
}

/** 退出前兜底：立即执行所有挂起的重建并等待完成 */
export function flushPendingIndexRebuilds(): Promise<void> {
  return defaultScheduler.flushPending()
}

/** 是否存在尚未完成的重建请求 */
export function hasPendingIndexRebuilds(): boolean {
  return defaultScheduler.hasPending()
}
