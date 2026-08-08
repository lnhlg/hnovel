import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Chapter,
  loadProjects, loadProjectById,
  loadChapters, saveChapter, deleteChapter
} from '../fileStorage'


import {
  saveChapterMD,
  deleteChapterMD,
  stripChapterTitle
} from '../markdownStorage'
import { now, extractTitleFromBodyMD } from './helpers'
import { validateOrThrow, chapterSaveSchema } from '../ipcValidation'



export function registerChapterHandlers(): void {
  ipcMain.handle('chapter:list', (_event, projectId: string) => {
    return loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('chapter:save', (_event, data: Partial<Chapter> & { projectId: string }) => {
    validateOrThrow(chapterSaveSchema, data, 'chapter:save')
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadChapters(data.projectId).find(c => c.id === data.id)
      if (!existing) return undefined
      // 标题解析优先级：正文区域起始的章节标题（如"第1章 惊变"）> preamble H1 > data.title > existing.title
      let resolvedTitle = existing.title
      if (data.content) {
        const bodyTitle = extractTitleFromBodyMD(data.content)
        if (bodyTitle) {
          resolvedTitle = bodyTitle
        } else {
          const preambleTitle = data.content.match(/^#\s+(.+)/m)?.[1]?.trim()
          if (preambleTitle) resolvedTitle = preambleTitle
          else if (data.title) resolvedTitle = data.title
        }
      } else if (data.title) {
        resolvedTitle = data.title
      }
      const chapter: Chapter = {
        ...existing,
        title: resolvedTitle,
        content: data.content ?? existing.content,
        outline: data.outline ?? existing.outline,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        wordCount: data.wordCount ?? existing.wordCount,
        status: data.status ?? existing.status,
        draftVersion: data.draftVersion ?? existing.draftVersion,
        updatedAt: time
      }
      saveChapter(data.projectId, chapter)

      // 同步保存到 MD 文件
      if (project && project.path) {
        // 删除旧 MD 文件（标题变更时）
        const oldClean = stripChapterTitle(existing.title)
        const oldFileName = `${existing.sortOrder + 1}. ${oldClean.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
        const oldFilePath = join(project.path, '章节', oldFileName)
        if (existsSync(oldFilePath)) unlinkSync(oldFilePath)
        saveChapterMD(project.path, chapter, chapter.sortOrder)
      }

      return chapter
    } else {
      const id = randomUUID()
      const chapters = loadChapters(data.projectId)
      const sortOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.sortOrder)) + 1 : 0
      const chapter: Chapter = {
        id, projectId: data.projectId,
        title: data.title ?? '未命名章节', content: data.content ?? '',
        outline: data.outline ?? '', sortOrder,
        wordCount: data.wordCount ?? 0, status: data.status ?? '草稿',
        draftVersion: data.draftVersion ?? 1,
        storyProgressSynced: 0,
        createdAt: time, updatedAt: time
      }
      saveChapter(data.projectId, chapter)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveChapterMD(project.path, chapter, sortOrder)
      }

      return chapter
    }
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
