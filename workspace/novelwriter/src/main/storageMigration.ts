import { existsSync } from 'fs'
import { join } from 'path'
import { atomicWriteFile } from './atomicWrite'
import { backupProjectData } from './projectBackup'
import {
  loadProjectById,
  loadProjects,
  loadChapters,
  loadCharacters,
  loadWorldSettings,
  loadTimelines,
  loadLocations,
  loadCharacterRelations,
  loadInspirations,
  loadReferences,
  loadWritingLogs
} from './fileStorage'
import { saveAllProjectDataMD, normalizeChapterMD } from './markdownStorage'

const MARKER = '.storage-v2'
const NORMALIZE_MARKER = '.md-normalized-v1'

/**
 * 一次性迁移：把 .novelwriter 的 JSON 实体完整写入书稿目录（MD 事实源）。
 * 迁移前强制全量备份；完成后写标记，之后不再执行。
 */
export async function migrateProjectStorage(projectId: string): Promise<{ migrated: boolean; backup?: string }> {
  const project = loadProjectById(projectId)
  if (!project?.path) return { migrated: false }
  const dataDir = join(project.path, '.novelwriter')
  if (!existsSync(join(dataDir, MARKER))) {
    const backup = backupProjectData(dataDir, join(project.path, '.novelwriter-backups'), 8, true)

    saveAllProjectDataMD(
      project.path,
      project,
      loadChapters(projectId),
      loadCharacters(projectId),
      loadWorldSettings(projectId),
      loadTimelines(projectId),
      loadLocations(projectId),
      loadCharacterRelations(projectId),
      loadInspirations(projectId),
      loadReferences(projectId),
      loadWritingLogs(projectId)
    )

    atomicWriteFile(join(dataDir, MARKER), new Date().toISOString())
    return { migrated: true, backup: backup ?? undefined }
  }
  return { migrated: false }
}

export async function migrateAllProjects(): Promise<string[]> {
  const migrated: string[] = []
  for (const project of loadProjects()) {
    const result = await migrateProjectStorage(project.id)
    if (result.migrated) migrated.push(project.name)
  }
  return migrated
}

/**
 * 一次性规范化章节 MD（消除历史文件里重复嵌入的章纲/标题）。
 * 依赖 .storage-v2 标记（先迁移后规范化），写 .md-normalized-v1 防重入。
 */
export async function normalizeAllProjects(): Promise<string[]> {
  const normalized: string[] = []
  for (const project of loadProjects()) {
    if (!project.path) continue
    const dataDir = join(project.path, '.novelwriter')
    if (!existsSync(join(dataDir, MARKER))) continue
    if (existsSync(join(dataDir, NORMALIZE_MARKER))) continue

    backupProjectData(dataDir, join(project.path, '.novelwriter-backups'), 8, true)
    const chapters = loadChapters(project.id)
    for (const ch of chapters) normalizeChapterMD(project.path, ch, ch.sortOrder)
    atomicWriteFile(join(dataDir, NORMALIZE_MARKER), new Date().toISOString())
    normalized.push(project.name)
  }
  return normalized
}
