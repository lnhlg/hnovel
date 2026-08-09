import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { join } from 'path'
import {
  loadProjectById,
  hasForeshadowRecords,
  loadForeshadowRecords,
  saveForeshadowRecord,
  deleteForeshadowRecord
} from '../fileStorage'
import {
  openIndex,
  saveIndex,
  rebuildSearchIndex,
  searchIndex,
  listForeshadows
} from '../indexStore'
import type { SearchOptions, Foreshadow } from '../indexStore'
import { collectIndexableDocs } from '../indexDocs'

function indexPathFor(projectId: string): string | null {
  const project = loadProjectById(projectId)
  if (!project?.path) return null
  return join(project.path, '.novelwriter', 'index.db')
}

export function registerSearchHandlers(): void {
  // 从书稿目录全量重建索引
  ipcMain.handle('index:rebuild', async (_event, projectId: string) => {
    const project = loadProjectById(projectId)
    if (!project?.path) throw new Error('项目不存在或未设置路径')
    const dbPath = join(project.path, '.novelwriter', 'index.db')
    const db = await openIndex(dbPath)
    try {
      const docs = collectIndexableDocs(project.path)
      rebuildSearchIndex(db, docs)
      saveIndex(db, dbPath)
      return { success: true, count: docs.length }
    } finally {
      db.close()
    }
  })

  // 全书搜索；索引缺失或为空时自动重建
  ipcMain.handle('index:search', async (_event, projectId: string, query: string, options?: SearchOptions) => {
    const dbPath = indexPathFor(projectId)
    if (!dbPath) return []
    const db = await openIndex(dbPath)
    try {
      const countRow = db.exec('SELECT COUNT(*) FROM search_docs')[0]
      if (!countRow || Number(countRow.values[0][0]) === 0) {
        const project = loadProjectById(projectId)
        if (project?.path) {
          rebuildSearchIndex(db, collectIndexableDocs(project.path))
          saveIndex(db, dbPath)
        }
      }
      return searchIndex(db, query, options)
    } finally {
      db.close()
    }
  })

  ipcMain.handle('foreshadow:list', async (_event, projectId: string) => {
    // 持久化源：项目数据 foreshadows.json；首次迁移旧索引里的伏笔线
    if (hasForeshadowRecords(projectId)) {
      return loadForeshadowRecords(projectId)
    }
    const dbPath = indexPathFor(projectId)
    if (dbPath) {
      const db = await openIndex(dbPath)
      try {
        const legacy = listForeshadows(db)
        for (const f of legacy) saveForeshadowRecord(projectId, f)
        return legacy
      } finally {
        db.close()
      }
    }
    return []
  })

  ipcMain.handle('foreshadow:save', async (_event, projectId: string, data: Partial<Foreshadow> & { id?: string }) => {
    const now = new Date().toISOString()
    const f: Foreshadow = {
      id: data.id ?? randomUUID(),
      title: data.title ?? '未命名伏笔线',
      status: data.status ?? 'planted',
      chapterId: data.chapterId,
      marker: data.marker,
      notes: data.notes,
      createdAt: data.createdAt ?? now,
      updatedAt: now
    }
    saveForeshadowRecord(projectId, f)
    return f
  })

  ipcMain.handle('foreshadow:delete', async (_event, projectId: string, id: string) => {
    deleteForeshadowRecord(projectId, id)
    return { success: true }
  })
}

/** 从书稿目录全量重建项目索引（保存章节后由写路径调用，索引允许滞后） */
export async function rebuildProjectIndex(projectId: string): Promise<{ success: boolean; count: number }> {
  const project = loadProjectById(projectId)
  if (!project?.path) return { success: false, count: 0 }
  const dbPath = join(project.path, '.novelwriter', 'index.db')
  const db = await openIndex(dbPath)
  try {
    const docs = collectIndexableDocs(project.path)
    rebuildSearchIndex(db, docs)
    saveIndex(db, dbPath)
    return { success: true, count: docs.length }
  } finally {
    db.close()
  }
}
