import { randomUUID } from 'crypto'
import { ipcMain, BrowserWindow } from 'electron'
import {
  loadProjects, saveProject, loadProjectById,
  loadStoryProgress, saveStoryProgress,
  loadChapters, saveChapter,
  loadCharacters,
  loadWorldSettings,
  loadTimelines,
  loadItems,
  loadDialogues,
  loadCharacterRelations,
  loadWritingStyles,
  loadSkills,
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
import { now, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges } from './helpers'
import { validateOrThrow, generateChapterOptsSchema, planChaptersOptsSchema } from '../ipcValidation'
import { rebuildProjectIndex } from './search'



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
          void rebuildProjectIndex(project.id).catch(console.error)
        }
        return chapter
      }
    }
    return undefined
  })

  // AI: 根据大纲生成章节内容
  ipcMain.handle('ai:generateChapter', async (_event, opts: {
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
    const window = BrowserWindow.getFocusedWindow()
    const sendChunk = window ? (chunk: string) => window.webContents.send('ai:chunk', chunk) : () => {}

    // 构建 prompt
    let prompt = '你是一位专业的小说作家。请根据以下信息生成一章完整的章节内容。\n\n'

    if (opts.synopsis) {
      prompt += `【小说大纲】\n${opts.synopsis}\n\n`
    }

    // 注入故事进展摘要，让 AI 了解已发生的剧情
    const storyProgress = loadStoryProgress(opts.projectId)
    if (storyProgress) {
      prompt += `【故事进展摘要】（已完成章节的剧情、伏笔、角色变化）\n${storyProgress}\n\n`
    }

    // 注入记忆数据（角色状态、物品、事件、对话、关系等）
    const chapters = loadChapters(opts.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
    const chOrderMap = new Map(chapters.map(c => [c.id, c.sortOrder]))
    const chOf = (s: string) => { const m = s.match(/\[ch:([^\]]+)\]/); return m ? (chOrderMap.get(m[1]) ?? 999) : 999 }
    const sortByCh = <T extends { chOrder: number }>(arr: T[]) => [...arr].sort((a, b) => a.chOrder - b.chOrder)
    const memoParts: string[] = []
    // 角色状态
    const allChars = loadCharacters(opts.projectId)
    const stLines: string[] = []
    for (const c of allChars) {
      if (!c.importantEvents) continue
      for (const line of c.importantEvents.split('\n').filter(Boolean)) {
        if (chOf(line) < 999) stLines.push(line.replace(/\[ch:.*?\]|（[^）]*）/g, '').trim())
      }
    }
    if (stLines.length > 0) memoParts.push(`角色状态变化：\n${stLines.join('\n')}`)
    // 物品
    const allItems = loadItems(opts.projectId)
    if (allItems.length > 0) {
      memoParts.push(`物品记录：\n${sortByCh(allItems.filter(i => i.chapterId).map(i => ({ chOrder: chOrderMap.get(i.chapterId) ?? 999, text: `- ${i.name}：状态-${i.status || '未知'}，持有者-${i.owner || '无'}` }))).map(i => i.text).join('\n')}`)
    }
    // 事件
    const allTimelines = loadTimelines(opts.projectId)
    const evLines = allTimelines.filter(t => t.description?.includes('[ch:')).map(t => ({ chOrder: chOf(t.description || ''), text: `- 第${chOf(t.description || '') + 1}章：${t.title}` })).filter(e => e.chOrder < 999)
    if (evLines.length > 0) memoParts.push(`已发生事件：\n${sortByCh(evLines).map(i => i.text).join('\n')}`)
    // 对话
    const allDialogues = loadDialogues(opts.projectId)
    const dlgLines = allDialogues.filter(d => d.chapterId).map(d => ({ chOrder: chOrderMap.get(d.chapterId) ?? 999, text: `- 第${(chOrderMap.get(d.chapterId) ?? 999) + 1}章：${d.speaker}对${d.with}说"${d.content.slice(0, 60)}${d.content.length > 60 ? '...' : ''}"` })).filter(d => d.chOrder < 999)
    if (dlgLines.length > 0) memoParts.push(`关键对话：\n${sortByCh(dlgLines).map(i => i.text).join('\n')}`)
    // 人物关系演变
    const allRels = loadCharacterRelations(opts.projectId)
    const relEntries: { key: string; chOrder: number; text: string }[] = []
    for (const r of allRels) {
      if (!r.description?.includes('[ch:')) continue
      const c1 = allChars.find(c => c.id === r.characterId1)
      const c2 = allChars.find(c => c.id === r.characterId2)
      if (!c1 || !c2) continue
      relEntries.push({ key: [c1.name, c2.name].sort().join(':'), chOrder: chOf(r.description), text: `${c1.name} ↔ ${c2.name}：${r.relation}` })
    }
    if (relEntries.length > 0) {
      const relMap = new Map<string, string[]>()
      for (const e of sortByCh(relEntries)) {
        const arr = relMap.get(e.key) || []; arr.push(e.text.split('：')[1] || e.text); relMap.set(e.key, arr)
      }
      memoParts.push(`人物关系演变：\n${[...relMap.entries()].map(([k, v]) => { const n = k.split(':'); return `- ${n[0]} ↔ ${n[1]}：${v.join(' → ')}` }).join('\n')}`)
    }
    // 人物-物品/组织关联
    const allWS = loadWorldSettings(opts.projectId)
    const assocLines = allWS.filter(ws => (ws.category === '人物-物品关系' || ws.category === '人物-组织关系') && ws.description?.includes('[ch:')).map(ws => {
      const [charName, targetRaw] = ws.key.split('→').map(s => s.trim())
      return { chOrder: chOf(ws.description), text: `- ${charName} → ${(targetRaw || '').replace(/@.*$/, '')}：${ws.value || '关联'}` }
    }).filter(a => a.chOrder < 999)
    if (assocLines.length > 0) memoParts.push(`人物关联：\n${sortByCh(assocLines).map(i => i.text).join('\n')}`)
    if (memoParts.length > 0) {
      prompt += `【记忆数据】（从已有章节提取的记忆信息）\n${memoParts.join('\n\n')}\n\n`
    }

    // 注入写作风格指令（优先使用项目选中的文风）
    const projectWritingStyleId = loadProjectById(opts.projectId)?.writingStyleId
    let styleToUse
    if (projectWritingStyleId) {
      styleToUse = loadWritingStyles().find(s => s.id === projectWritingStyleId)
    }
    if (styleToUse) {
      prompt += '【写作风格指令】\n'
      prompt += `- ${styleToUse.name}：${styleToUse.instructions}\n`
      prompt += '\n请严格遵循上述写作风格进行创作。\n\n'
    } else {
      const styles = loadWritingStyles()
      if (styles.length > 0) {
        prompt += '【写作风格指令】\n'
        for (const style of styles) {
          prompt += `- ${style.name}：${style.instructions}\n`
        }
        prompt += '\n请严格遵循上述写作风格进行创作。\n\n'
      }
    }

    // 注入「去AI味」技能（使用项目选中的）
    const skillId = loadProjectById(opts.projectId)?.skillId
    if (skillId) {
      const selectedSkill = loadSkills().find(s => s.id === skillId)
      if (selectedSkill) {
        prompt += '【写作技能指令（去AI味）】\n'
        prompt += `- ${selectedSkill.name}：${selectedSkill.content}\n`
        prompt += '\n请严格遵循上述写作技能进行创作。\n\n'
      }
    }

    if (opts.previousChapters.length > 0) {
      // 最近 2 章的完整正文作为上下文
      const recentTwo = opts.previousChapters.slice(-2)
      for (const ch of recentTwo) {
        const cleanContent = ch.content.replace(/<[^>]*>/g, '').replace(/([。；！？])\s*，/g, '$1').trim()
        if (cleanContent) {
          prompt += `【前章正文：${ch.title}】\n${cleanContent}\n\n`
        }
      }
    }

    // 本章概要紧挨生成指令，让 AI 聚焦
    if (opts.chapterOutline) {
      prompt += `【本章概要——请严格按照此大纲生成正文】\n${opts.chapterOutline}\n\n`
    }

    prompt += `请生成章节「${opts.chapterTitle}」的完整内容。要求：\n`
    prompt += '1. 保持风格与前面章节一致\n'
    prompt += '2. 章节有合理的起承转合\n'
    prompt += '3. 对话自然，描写生动\n'
    prompt += '4. 字数在 2000-5000 字之间\n'
    prompt += '5. 【关键】必须严格遵循【本章概要——请严格按照此大纲生成正文】中的剧情流程、冲突设计和伏笔安排，不得偏离大纲内容\n'

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
  ipcMain.handle('ai:planChapters', async (_event, opts: {
    synopsis: string
    numChapters: number
    genre?: string
    providerId?: string
    model?: string
    requestId?: string
  }) => {
    validateOrThrow(planChaptersOptsSchema, opts, 'ai:planChapters')
    const window = BrowserWindow.getFocusedWindow()
    const sendChunk = window ? (chunk: string) => window.webContents.send('ai:chunk', chunk) : () => {}

    const prompt = `你是一位专业的小说编辑。请根据以下小说大纲，规划 ${opts.numChapters} 章的章节安排。

【小说大纲】
${opts.synopsis}

请以 JSON 格式输出，格式如下：
[
  { "title": "章节标题", "outline": "本章概要（50-100字）" },
  ...
]

要求：
1. 章节标题要吸引人
2. 每章的概要要包含该章的主要情节发展
3. ${opts.numChapters} 章要覆盖从开头到结尾的完整故事弧
4. 每章之间要有合理的剧情递进`

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

    // 尝试从结果中提取 JSON
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
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
