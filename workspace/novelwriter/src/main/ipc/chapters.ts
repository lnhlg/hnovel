import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import { Chapter,
  loadProjects, loadProjectById,
  loadChapters, saveChapter, deleteChapter
} from '../fileStorage'


import {
  saveChapterMD,
  deleteChapterMD
} from '../markdownStorage'
import { now, saveChapterWithMd } from './helpers'
import { validateOrThrow, chapterSaveSchema } from '../ipcValidation'
import { scheduleProjectIndexRebuild } from '../indexRebuild'



export function registerChapterHandlers(): void {
  ipcMain.handle('chapter:list', (_event, projectId: string) => {
    return loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('chapter:save', (_event, data: Partial<Chapter> & { projectId: string }) => {
    validateOrThrow(chapterSaveSchema, data, 'chapter:save')
    const saved = saveChapterWithMd(data.projectId, data)
    // 保存后防抖刷新搜索索引（书稿目录为事实源，索引允许短暂滞后）
    scheduleProjectIndexRebuild(data.projectId)
    return saved
  })

  ipcMain.handle('chapter:delete', (_event, id: string) => {
    // 需要找到 projectId 才能删除
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const chapters = loadChapters(project.id)
      const chapter = chapters.find(c => c.id === id)
      if (chapter) {
        deleteChapter(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteChapterMD(project.path, chapter.title, chapter.sortOrder)
        }
        scheduleProjectIndexRebuild(project.id)
        break
      }
    }
    return { success: true }
  })

  ipcMain.handle('chapter:create', (_event, projectId: string) => {
    const id = randomUUID()
    const time = now()
    const chapters = loadChapters(projectId)
    const sortOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.sortOrder)) + 1 : 0
    const chapter: Chapter = {
      id, projectId, title: '新建章节', content: '',
      outline: '', sortOrder, wordCount: 0, status: '草稿',
      draftVersion: 1, storyProgressSynced: 0, createdAt: time, updatedAt: time
    }
    saveChapter(projectId, chapter)

    // 同步保存到 MD 文件
    const project = loadProjectById(projectId)
    if (project && project.path) {
      saveChapterMD(project.path, chapter, sortOrder)
    }

    return chapter
  })
}
