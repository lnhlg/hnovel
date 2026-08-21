import { randomUUID } from 'crypto'
import { ipcMain, BrowserWindow } from 'electron'
import {
  loadProjects, saveProject, loadProjectById,
  loadStoryProgress, saveStoryProgress,
  loadChapters, saveChapter,
  loadAIProviders
} from '../fileStorage'
import {
  getActiveProvider,
  chatOpenAI,
  chatOpenAIStream,
  chatOllama,
  loadActiveProvider,
  registerAbortController,
  releaseAbortController
} from '../ai'
import type { ChatMessage } from '../ai'
import {
  saveChapterMD,
  readChapterContent,
  saveStoryProgressMD
} from '../markdownStorage'
import { now, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges, extractFirstBalanced } from './helpers'
import { validateOrThrow, generateChapterOptsSchema, planChaptersOptsSchema } from '../ipcValidation'
import { scheduleProjectIndexRebuild } from '../indexRebuild'
import { buildGenerateChapterPrompt, buildPlanChaptersPrompt } from '../prompts'



export function registerAIOutlineHandlers(): void {
  // 保存项目 synopsis
  ipcMain.handle('project:saveSynopsis', (_event, projectId: string, synopsis: string) => {
    const project = loadProjectById(projectId)
    if (!project) return undefined
    const time = now()
    project.synopsis = synopsis
    project.updatedAt = time
    saveProject(project)
    return project
  })

  // 保存章节 outline
  ipcMain.handle('chapter:saveOutline', (_event, chapterId: string, outline: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const chapters = loadChapters(project.id).sort((a, b) => a.sortOrder - b.sortOrder)
      const chapter = chapters.find(c => c.id === chapterId)
      if (chapter) {
        chapter.outline = outline
        chapter.updatedAt = now()
        saveChapter(project.id, chapter)
        // 同步保存到 MD 文件
        if (project.path) {
          const index = chapters.findIndex(c => c.id === chapterId)
          saveChapterMD(project.path, chapter, index)
          scheduleProjectIndexRebuild(project.id)
        }
        return chapter
      }
    }
    return undefined
  })

  // AI: 根据大纲生成章节内容
  ipcMain.handle('ai:generateChapter', async (event, opts: {
    projectId: string
    chapterId: string
    synopsis: string
    chapterTitle: string
    chapterOutline: string
    providerId?: string
    model?: string
    requestId?: string
    previousChapters: { title: string; content: string }[]
  }) => {
    validateOrThrow(generateChapterOptsSchema, opts, 'ai:generateChapter')
    // 用事件来源窗口而非聚焦窗口：多窗口/失焦时流式 chunk 也能推给发起方
    const window = BrowserWindow.fromWebContents(event.sender)
    const sendChunk = window ? (chunk: string) => window.webContents.send('ai:chunk', chunk) : () => {}

    // 构建 prompt（模板收敛在 ../prompts.ts）
    const prompt = buildGenerateChapterPrompt({
      projectId: opts.projectId,
      synopsis: opts.synopsis,
      chapterTitle: opts.chapterTitle,
      chapterOutline: opts.chapterOutline,
      previousChapters: opts.previousChapters
    })

    const messages = [
      { role: 'system', content: '你是一位专业的小说作家。请严格遵循用户提供的章节大纲来生成正文，不得偏离大纲规定的剧情流程、冲突和人物变化。请用中文写作。' },
      { role: 'user', content: prompt }
    ]

    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }
    if (opts.providerId) {
      provider = loadAIProviders().find(p => p.id === opts.providerId) ?? provider
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = opts.model || await ensureModel(provider)

    // 支持按 requestId 中止生成
    const requestId = opts.requestId || randomUUID()
    const abortController = new AbortController()
    registerAbortController(requestId, abortController)
    try {
      if (provider.type === 'ollama') {
        return await chatOllama(provider, model, messages as ChatMessage[], sendChunk, abortController.signal)
      } else {
        return await chatOpenAIStream(provider, model, messages as ChatMessage[], sendChunk, abortController.signal)
      }
    } finally {
      releaseAbortController(requestId)
    }
  })

  // AI: 根据大纲规划章节列表
  ipcMain.handle('ai:planChapters', async (event, opts: {
    synopsis: string
    numChapters: number
    genre?: string
    providerId?: string
    model?: string
    requestId?: string
  }) => {
    validateOrThrow(planChaptersOptsSchema, opts, 'ai:planChapters')
    const window = BrowserWindow.fromWebContents(event.sender)
    const sendChunk = window ? (chunk: string) => window.webContents.send('ai:chunk', chunk) : () => {}

    const prompt = buildPlanChaptersPrompt({ synopsis: opts.synopsis, numChapters: opts.numChapters })

    const messages = [
      { role: 'system', content: '你是一位专业的小说编辑，擅长规划小说结构。请用中文回答，只输出 JSON。' },
      { role: 'user', content: prompt }
    ]

    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }
    if (opts.providerId) {
      provider = loadAIProviders().find(p => p.id === opts.providerId) ?? provider
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = opts.model || await ensureModel(provider)

    let result: string
    const requestId = opts.requestId || randomUUID()
    const abortController = new AbortController()
    registerAbortController(requestId, abortController)
    try {
      if (provider.type === 'ollama') {
        result = await chatOllama(provider, model, messages as ChatMessage[], undefined, abortController.signal)
      } else {
        result = await chatOpenAI(provider, model, messages as ChatMessage[], abortController.signal)
      }
    } finally {
      releaseAbortController(requestId)
    }

    // 尝试从结果中提取 JSON（支持 ```json 围栏与括号配对，避免误抓说明文字）
    const jsonText = extractFirstBalanced(result, '[', ']')
    if (jsonText) {
      try {
        return JSON.parse(jsonText)
      } catch {
        return { error: 'AI 返回的格式不正确', raw: result }
      }
    }
    return { error: '未能从 AI 响应中提取章节规划', raw: result }
  })

  // ===== 故事进展 =====

  // 获取故事进展摘要
  ipcMain.handle('storyProgress:get', (_event, projectId: string) => {
    return loadStoryProgress(projectId)
  })

  // 手动保存/编辑故事进展摘要
  ipcMain.handle('storyProgress:save', (_event, projectId: string, newStoryProgress: string) => {
    saveStoryProgress(projectId, newStoryProgress)
    const project = loadProjectById(projectId)
    if (project?.path) {
      saveStoryProgressMD(project.path, newStoryProgress)
    }
    return true
  })

  // 从已有章节自动构建/更新故事进展摘要
  ipcMain.handle('storyProgress:autoUpdate', (_event, projectId: string) => {
    const project = loadProjectById(projectId)
    const projectPath = project?.path

    const chapters = loadChapters(projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (chapters.length === 0) return ''

    const entries: string[] = []
    const allForeshadow: string[] = []
    const allCharChanges: Map<string, string[]> = new Map()

    // 先尝试从 MD 文件同步缺失的大纲
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i]
      if (!ch.outline?.trim() && projectPath) {
        const mdContent = readChapterContent(projectPath, i, ch.title)
        if (mdContent) {
          const outlineMatch = mdContent.match(/## 本章概要\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/)
          const mdOutline = outlineMatch?.[1]?.trim()
          if (mdOutline) {
            ch.outline = mdOutline
            saveChapter(projectId, ch)
          }
        }
      }
    }

    // 重新加载章节（获取同步后的数据）
    const syncedChapters = loadChapters(projectId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (const ch of syncedChapters) {
      const outline = ch.outline || ''
      const title = ch.title || `第${ch.sortOrder + 1}章`
      const overview = extractField(outline, '本章剧情概述')
      const plotFlow = extractListItems(outline, '剧情流程')
      const conflicts = extractConflict(outline)
      const infoRelease = extractListItems(outline, '释放信息')
      const foreshadow = extractListItems(outline, '埋下伏笔')
      const charChangeRaw = extractCharChanges(outline)
      const hook = extractField(outline, '章节结尾钩子')

      const entryParts: string[] = [
        `### 第${ch.sortOrder + 1}章「${title}」`,
      ]
      const hasStructuredData = overview || plotFlow.length > 0 || infoRelease.length > 0 ||
        foreshadow.length > 0 || charChangeRaw.length > 0 || hook

      if (overview) {
        const brief = overview.replace(/\n/g, ' ').slice(0, 800)
        entryParts.push(`- 剧情概述：${brief}`)
      }
      if (plotFlow.length > 0) {
        entryParts.push(`- 关键事件：${plotFlow.slice(0, 3).join(' → ')}`)
      }
      if (infoRelease.length > 0) {
        entryParts.push(`- 释放信息：${infoRelease.join('；')}`)
      }
      if (foreshadow.length > 0) {
        entryParts.push(`- 埋下伏笔：${foreshadow.join('；')}`)
        allForeshadow.push(...foreshadow.map(f => `${f}（第${ch.sortOrder + 1}章）`))
      }
      if (charChangeRaw.length > 0) {
        entryParts.push(`- 人物变化：${charChangeRaw.join('；')}`)
        for (const change of charChangeRaw) {
          const name = change.split('：')[0]?.trim() || change.split(':')[0]?.trim()
          if (name) {
            const list = allCharChanges.get(name) || []
            list.push(`第${ch.sortOrder + 1}章：${change}`)
            allCharChanges.set(name, list)
          }
        }
      }
      if (hook) {
        entryParts.push(`- 结尾钩子：${hook.replace(/\n/g, ' ').slice(0, 300)}`)
      }

      // 如果结构化解析无结果但有 outline 原文，回退显示原始内容片段
      if (!hasStructuredData && outline.trim()) {
        const rawSnippet = outline.trim().replace(/\n/g, ' ').slice(0, 200)
        entryParts.push(`- 概要：${rawSnippet}...`)
      }

      // 没有任何大纲内容时显示占位
      if (!hasStructuredData && !outline.trim()) {
        entryParts.push('（暂未填写大纲）')
      }

      entries.push(entryParts.join('\n'))
    }

    const parts: string[] = [
      '## 已完成章节',
      '',
      entries.join('\n\n'),
    ]

    // 活跃冲突/剧情线
    const allConflicts = syncedChapters.map(ch => {
      const c = extractConflict(ch.outline || '')
      return c.length > 0 ? `第${ch.sortOrder + 1}章：${c.join('；')}` : ''
    }).filter(Boolean)
    if (allConflicts.length > 0) {
      parts.push('', '## 活跃冲突/剧情线', '')
      parts.push(allConflicts.join('\n'))
    }

    // 待回收伏笔
    if (allForeshadow.length > 0) {
      parts.push('', '## 待回收伏笔', '')
      parts.push(allForeshadow.map(f => `- ${f}`).join('\n'))
    }

    // 角色现状
    if (allCharChanges.size > 0) {
      parts.push('', '## 角色现状', '')
      for (const [name, changes] of allCharChanges) {
        parts.push(`- ${name}：${changes.join('；')}`)
      }
    }

    const newStoryProgress = parts.join('\n')

    // 保存到 JSON 和 MD
    saveStoryProgress(projectId, newStoryProgress)
    const savedProject = loadProjectById(projectId)
    if (savedProject?.path) {
      saveStoryProgressMD(savedProject.path, newStoryProgress)
    }

    return newStoryProgress
  })
}
