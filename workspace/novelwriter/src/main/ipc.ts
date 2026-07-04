import { randomUUID } from 'crypto'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  Project, Chapter, Character, WorldSetting, Timeline, Location, CharacterRelation, Inspiration, WritingLog, Reference, WritingStyle, Skill,
  loadProjects, saveProject, deleteProject, loadProjectById,
  loadStoryProgress, saveStoryProgress,
  loadChapters, saveChapter, deleteChapter,
  loadCharacters, saveCharacter, deleteCharacter,
  loadWorldSettings, saveWorldSetting, deleteWorldSetting,
  loadTimelines, saveTimeline, deleteTimeline,
  loadLocations, saveLocation, deleteLocation,
  loadCharacterRelations, saveCharacterRelation, deleteCharacterRelation,
  loadInspirations, saveInspiration, deleteInspiration,
  loadWritingLogs, saveWritingLog, deleteWritingLog,
  loadReferences, saveReference, deleteReference,
  loadWritingStyles, saveWritingStyle, deleteWritingStyle, getNextWritingStyleSortOrder,
  loadSkills, saveSkill, deleteSkill, getNextSkillSortOrder
} from './fileStorage'
import {
  getActiveProvider,
  getCurrentModel,
  setCurrentModel,
  chatOpenAI,
  chatOpenAIStream,
  chatOllama,
  loadActiveProvider,
  listOpenAIModels,
  listOllamaModels
} from './ai'
import type { AIProvider } from './fileStorage'
import {
  ensureProjectDirs,
  saveProjectMD,
  saveCharacterMD,
  deleteCharacterMD,
  saveWorldSettingMD,
  deleteWorldSettingMD,
  saveChapterMD,
  deleteChapterMD,
  saveTimelineMD,
  saveLocationMD,
  deleteLocationMD,
  saveCharacterRelationsMD,
  saveInspirationsMD,
  saveReferencesMD,
  saveWritingLogsMD,
  saveAllProjectDataMD,
  readProjectContent,
  writeProjectContent,
  readCharacterContent,
  writeCharacterContent,
  readChapterContent,
  writeChapterContent,
  readWorldSettingContent,
  writeWorldSettingContent,
  readLocationContent,
  writeLocationContent,
  readTimelineContent,
  writeTimelineContent,
  readCharacterRelationsContent,
  writeCharacterRelationsContent,
  readInspirationsContent,
  writeInspirationsContent,
  readReferencesContent,
  writeReferencesContent,
  readWritingLogsContent,
  writeWritingLogsContent,
  readProjectMD,
  readCharacterMD,
  saveCharactersMD,
  readCharactersContent,
  writeCharactersContent,
  saveWorldSettingsMD,
  readWorldSettingsContent,
  writeWorldSettingsContent,
  saveLocationsMD,
  readLocationsContent,
  writeLocationsContent,
  parseCharactersFromMD,
  parseWorldSettingsFromMD,
  parseLocationsFromMD,
  stripChapterTitle,
  saveStoryProgressMD,
  readStoryProgressMD
} from './markdownStorage'

function now(): string {
  return new Date().toISOString()
}

// 确保有可用的模型：如果当前模型为空，自动获取第一个
async function ensureModel(provider: AIProvider): Promise<string> {
  let model = getCurrentModel()
  if (model) return model

  // 模型为空，自动获取列表
  const models = provider.type === 'ollama'
    ? await listOllamaModels(provider)
    : await listOpenAIModels(provider)

  if (models.length > 0) {
    model = models[0].id
    setCurrentModel(model)
    return model
  }

  // 获取不到列表，用默认模型名
  model = provider.type === 'ollama' ? 'qwen2.5' : 'gpt-3.5-turbo'
  setCurrentModel(model)
  return model
}

export function registerProjectHandlers(): void {
  ipcMain.handle('project:create', (_event, name: string) => {
    const id = randomUUID()
    const time = now()
    const project: Project = {
      id, name, description: '', synopsis: '', path: '', genre: '',
      wordCountTarget: 0, status: '构思中', worldBackground: '',
      storyProgress: '',
      writingStyleId: '',
      createdAt: time, updatedAt: time
    }
    saveProject(project)
    return project
  })

  ipcMain.handle('project:createWithPath', (_event, name: string, folderPath: string) => {
    const id = randomUUID()
    const time = now()
    // 在选中的文件夹下创建一个以项目名命名的子目录
    const projectDir = join(folderPath, name.replace(/[<>:"/\\|?*]/g, '_'))
    try {
      mkdirSync(projectDir, { recursive: true })
    } catch (err) {
      console.error('创建项目文件夹失败:', err)
      throw new Error('无法创建项目文件夹，请检查权限')
    }
    const project: Project = {
      id, name, description: '', synopsis: '', path: projectDir, genre: '',
      wordCountTarget: 0, status: '构思中', worldBackground: '',
      storyProgress: '',
      writingStyleId: '',
      createdAt: time, updatedAt: time
    }
    saveProject(project)
    return project
  })

  ipcMain.handle('project:open', (_event, projectId: string) => {
    return loadProjectById(projectId)
  })

  ipcMain.handle('project:list', () => {
    return loadProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })

  ipcMain.handle('project:save', (_event, data: Partial<Project> & { id: string }) => {
    const time = now()
    const existing = loadProjectById(data.id)
    if (!existing) return undefined
    const project: Project = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      synopsis: data.synopsis ?? existing.synopsis,
      path: data.path ?? existing.path,
      genre: data.genre ?? existing.genre,
      wordCountTarget: data.wordCountTarget ?? existing.wordCountTarget,
      status: data.status ?? existing.status,
      worldBackground: data.worldBackground ?? existing.worldBackground,
      writingStyleId: data.writingStyleId ?? existing.writingStyleId,
      updatedAt: time
    }
    saveProject(project)

    // 同步保存到 MD 文件
    if (project.path) {
      saveProjectMD(project.path, project)
    }

    return project
  })

  ipcMain.handle('project:delete', (_event, id: string) => {
    deleteProject(id)
    return { success: true }
  })
}

export function registerChapterHandlers(): void {
  ipcMain.handle('chapter:list', (_event, projectId: string) => {
    return loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('chapter:save', (_event, data: Partial<Chapter> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadChapters(data.projectId).find(c => c.id === data.id)
      if (!existing) return undefined
      const chapter: Chapter = {
        ...existing,
        // 优先从正文中提取标题
        title: stripChapterTitle(
          data.content
            ? (data.content.match(/^#\s+(.+)/m)?.[1]?.trim() || data.title) ?? existing.title
            : (data.title ?? existing.title)
        ),
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
        title: stripChapterTitle(data.title ?? '未命名章节'), content: data.content ?? '',
        outline: data.outline ?? '', sortOrder,
        wordCount: data.wordCount ?? 0, status: data.status ?? '草稿',
        draftVersion: data.draftVersion ?? 1,
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
      draftVersion: 1, createdAt: time, updatedAt: time
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

export function registerCharacterHandlers(): void {
  ipcMain.handle('character:list', (_event, projectId: string) => {
    return loadCharacters(projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })

  ipcMain.handle('character:save', (_event, data: Partial<Character> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadCharacters(data.projectId).find(c => c.id === data.id) : null

    console.log('[character:save] data:', JSON.stringify(data, null, 2))
    console.log('[character:save] existing found:', !!existing)
    console.log('[character:save] project.path:', project?.path)

    if (existing) {
      const character: Character = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        traits: data.traits ?? existing.traits,
        age: data.age ?? existing.age,
        appearance: data.appearance ?? existing.appearance,
        background: data.background ?? existing.background,
        personality: data.personality ?? existing.personality,
        role: data.role ?? existing.role,
        skills: data.skills ?? existing.skills,
        relationships: data.relationships ?? existing.relationships,
        motivation: data.motivation ?? existing.motivation,
        flaws: data.flaws ?? existing.flaws,
        growthArc: data.growthArc ?? existing.growthArc,
        gender: data.gender ?? existing.gender,
        dynasty: data.dynasty ?? existing.dynasty,
        birthplace: data.birthplace ?? existing.birthplace,
        heightBuild: data.heightBuild ?? existing.heightBuild,
        face: data.face ?? existing.face,
        hairstyle: data.hairstyle ?? existing.hairstyle,
        clothing: data.clothing ?? existing.clothing,
        talents: data.talents ?? existing.talents,
        likes: data.likes ?? existing.likes,
        importantEvents: data.importantEvents ?? existing.importantEvents,
        relationshipsDetail: data.relationshipsDetail ?? existing.relationshipsDetail,
        weaknesses: data.weaknesses ?? existing.weaknesses,
        specialMarks: data.specialMarks ?? existing.specialMarks,
        updatedAt: time
      }
      saveCharacter(data.projectId, character)
      console.log('[character:save] updated character:', JSON.stringify(character, null, 2))

      // 验证：保存后重新读取确认一致
      const afterSave = loadCharacters(data.projectId).find(c => c.id === character.id)
      console.log('[character:save] reread from file found:', !!afterSave)
      if (afterSave) {
        console.log('[character:save] reread name:', afterSave.name)
        console.log('[character:save] reread appearance:', afterSave.appearance)
        console.log('[character:save] appearance match:', afterSave.appearance === character.appearance)
      }

      // 同步保存到 MD 文件
      if (project && project.path) {
        if (data.name && data.name !== existing.name) {
          deleteCharacterMD(project.path, existing.name)
        }
        saveCharacterMD(project.path, character)
        saveCharactersMD(project.path, loadCharacters(data.projectId))
        console.log('[character:save] MD files saved')
      } else {
        console.log('[character:save] MD files SKIPPED (no project path)')
      }

      return character
    } else {
      // data.id 存在但未找到，或 data.id 不存在，都走新建分支
      const id = data.id || randomUUID()
      const character: Character = {
        id, projectId: data.projectId,
        name: data.name ?? '', description: data.description ?? '',
        traits: data.traits ?? '', age: data.age ?? 0,
        appearance: data.appearance ?? '', background: data.background ?? '',
        personality: data.personality ?? '', role: data.role ?? '',
        skills: data.skills ?? '', relationships: data.relationships ?? '',
        motivation: data.motivation ?? '', flaws: data.flaws ?? '',
        growthArc: data.growthArc ?? '',
        gender: data.gender ?? '', dynasty: data.dynasty ?? '',
        birthplace: data.birthplace ?? '', heightBuild: data.heightBuild ?? '',
        face: data.face ?? '', hairstyle: data.hairstyle ?? '',
        clothing: data.clothing ?? '', talents: data.talents ?? '',
        likes: data.likes ?? '', importantEvents: data.importantEvents ?? '',
        relationshipsDetail: data.relationshipsDetail ?? '',
        weaknesses: data.weaknesses ?? '', specialMarks: data.specialMarks ?? '',
        createdAt: time, updatedAt: time
      }
      saveCharacter(data.projectId, character)
      console.log('[character:save] NEW character created:', JSON.stringify(character, null, 2))

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveCharacterMD(project.path, character)
        saveCharactersMD(project.path, loadCharacters(data.projectId))
        console.log('[character:save] MD files saved')
      }

      return character
    }
  })

  ipcMain.handle('character:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const characters = loadCharacters(project.id)
      const character = characters.find(c => c.id === id)
      if (character) {
        deleteCharacter(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteCharacterMD(project.path, character.name)
          saveCharactersMD(project.path, loadCharacters(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:open', async (event, options: Electron.OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(window, options)
  })

  ipcMain.handle('dialog:save', async (event, options: Electron.SaveDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePath: '' }
    return dialog.showSaveDialog(window, options)
  })

  ipcMain.handle('dialog:select-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(window, {
      title: '选择项目文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    return result
  })

  // 读取文件内容（用于章节大纲/正文导入）
  ipcMain.handle('file:readText', async (event, filePath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, content: '' }
    try {
      const { readFileSync } = await import('fs')
      const content = readFileSync(filePath, 'utf-8')
      return { canceled: false, content }
    } catch (err) {
      console.error('读取文件失败:', err)
      return { canceled: true, content: '', error: err instanceof Error ? err.message : String(err) }
    }
  })
}

// ===== AI 大纲与章节生成 =====

// 解析大纲中指定标题下的纯文本字段内容
function extractField(outline: string, fieldTitle: string): string {
  const regex = new RegExp(`### ${fieldTitle}\\n([\\s\\S]*?)(?=\\n### |\
$)`)
  const match = outline.match(regex)
  if (!match) return ''
  return match[1].trim().replace(/^- /gm, '').trim()
}

// 解析大纲中指定标题下的列表项
function extractListItems(outline: string, fieldTitle: string): string[] {
  const field = extractField(outline, fieldTitle)
  if (!field) return []
  const items = field.split('\n').map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim()).filter(Boolean)
  return items
}

// 解析冲突字段为字符串数组
function extractConflict(outline: string): string[] {
  const field = extractField(outline, '本章冲突')
  if (!field) return []
  return field.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
}

// 解析人物变化字段为字符串数组
function extractCharChanges(outline: string): string[] {
  const field = extractField(outline, '人物变化')
  if (!field) return []
  return field.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
}

export function registerAIOutineHandlers(): void {
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
    previousChapters: { title: string; content: string }[]
  }) => {
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

    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = await ensureModel(provider)

    if (provider.type === 'ollama') {
      return await chatOllama(provider, model, messages as ChatMessage[], sendChunk)
    } else {
      return await chatOpenAIStream(provider, model, messages as ChatMessage[], sendChunk)
    }
  })

  // AI: 根据大纲规划章节列表
  ipcMain.handle('ai:planChapters', async (_event, opts: {
    synopsis: string
    numChapters: number
    genre?: string
  }) => {
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

    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = await ensureModel(provider)

    let result: string
    if (provider.type === 'ollama') {
      result = await chatOllama(provider, model, messages as ChatMessage[])
    } else {
      result = await chatOpenAI(provider, model, messages as ChatMessage[])
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

// ===== AI 引导式项目创建 =====

export interface WizardMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface WizardProjectData {
  name: string
  genre: string
  synopsis: string
  worldBackground: string
  chapters: { title: string; outline: string }[]
  characters: { name: string; description: string; traits: string; age: number; appearance: string; background: string; personality: string; role: string }[]
  worldSettings: { category: string; key: string; value: string; description: string }[]
  timelines: { title: string; description: string; date: string }[]
  locations: { name: string; description: string; type: string }[]
  characterRelations: { character1Name: string; character2Name: string; relation: string; description: string }[]
  inspirations: { title: string; type: string; content: string; source: string }[]
  references: { title: string; type: string; url: string; notes: string }[]
}

const wizardSessions = new Map<string, {
  messages: WizardMessage[]
  projectData: Partial<WizardProjectData>
  step: number
}>()

function getWizardSystemPrompt(): string {
  return `你是一位专业的小说创作顾问，正在帮助用户一步步创建一个完整的小说项目。请通过自然友好的对话，深入了解用户的创作想法，主动引导用户补充关键信息，最终帮用户规划出完整、丰富、可落地的小说项目。

## 你的核心能力
1. **主动引导**：根据用户已提供的信息，判断哪些方面还不足，主动提出有针对性的问题
2. **深度挖掘**：不满足于表面信息，追问细节（如角色的动机、世界观的规则、情节的转折等）
3. **创意建议**：根据题材特点，主动提出用户可能没想到的创意方向
4. **完整规划**：信息充足后，输出包含所有核心要素的完整项目结构

## 信息收集清单（逐步确认，不要一次性问完）
### 基础信息
- 项目名称/暂定名
- 题材类型（玄幻/都市/言情/悬疑/科幻/历史/仙侠 等）
- 故事的一句话核心概念

### 世界观设定
- 故事发生的时代/地点/世界背景
- 世界的核心规则（魔法体系/科技水平/社会制度/力量体系 等）
- 主要势力/阵营/国家
- 重要的历史事件（影响当前故事的）

### 角色设定
- 主角：姓名、年龄、外貌、性格、背景、目标、成长弧光
- 主要配角：至少 2-3 个，与主角的关系
- 反派/对手：设定与动机
- 角色之间的关系网络

### 故事结构
- 故事主线/核心冲突
- 故事的开端、发展、高潮、结局构想
- 主要情节转折点
- 预计的章节数量（建议 10-30 章）

### 场景地点
- 故事中的主要场景（城市/秘境/组织/家族 等）
- 每个地点的特点和在故事中的作用

## 对话策略
1. **循序渐进**：每次只聚焦 1-2 个方面，问 1 个问题，不要一次性抛太多问题
2. **灵活调整**：如果用户一次性提供了大量信息，直接吸收并进入下一个方面
3. **主动追问**：如果用户回答比较简略，主动追问细节（如"这个主角的目标是什么？"、"这个魔法体系有什么限制？"）
4. **创意补充**：在每个方面，除了用户说的，主动补充 1-2 个建议供用户参考
5. **进度感知**：在对话中自然地提到"我们已经确定了 XX，接下来聊聊 XX 吧"
6. **灵活响应**：用户可以随时跳转话题，不要拘泥于固定顺序
7. **选项按钮**：当你给出建议或让用户选择时，用 [[OPTION:选项文本]] 的格式列出每个选项，每行一个，让用户可以直接点击选择。例如：
   你想要什么题材的小说呢？
   [[OPTION:玄幻]]
   [[OPTION:都市]]
   [[OPTION:言情]]
   [[OPTION:悬疑]]
   或者你也可以直接告诉我你想要的题材~

## 何时可以生成项目
当以下信息基本齐备时，可以询问用户是否确认创建：
- ✅ 有明确的题材和核心概念
- ✅ 有基本的世界观设定
- ✅ 至少 2-3 个有细节的主要角色
- ✅ 有故事主线和大致章节规划

如果信息明显不足（比如只有题材，没有角色和剧情），**不要**输出项目规划，而是继续提问引导。

## 用户触发词
当用户说以下内容时，表示可以输出最终规划了：
"完成"、"就这些"、"开始创建"、"创建项目"、"确认"、"好的，生成吧"、"差不多了"、"生成项目规范" 等类似表述。
特别注意：当用户说"生成项目规范"或"开始生成"时，无论信息是否完整，都必须立即输出完整的项目规划。如果某些信息缺失，可以基于已有信息合理补充。

## 最终输出格式
确认创建时，用 \`\`\`project ... \`\`\` 包裹输出，使用以下纯文本格式（不要用 JSON）：

\`\`\`project
===项目信息===
名称：项目名称
题材：题材类型
简介：完整详细的故事大纲（300-500字，包含背景、主线、高潮、结局）
世界观背景：世界观背景总览（200-300字）

===角色===
---角色1---
姓名：角色名
描述：一句话角色描述
特征：性格特征（多个用逗号分隔）
年龄：年龄数字
外貌：外貌描写
背景：背景故事
性格：性格特点详细描述
定位：主角/重要配角/反派/路人

---角色2---
姓名：角色名
描述：一句话描述
特征：特征
年龄：年龄
外貌：外貌
背景：背景
性格：性格
定位：配角

===章节===
---章节1---
标题：第一章标题
大纲：本章概要（50-100字）

---章节2---
标题：第二章标题
大纲：本章概要

===世界观设定===
---设定1---
分类：魔法体系/社会制度/科技水平/力量体系
名称：设定名称
内容：设定的核心内容
说明：详细说明与规则

===时间线===
---节点1---
名称：时间节点名称
描述：事件的详细描述
时间：故事开始前 100 年 / 第 3 章

===地点===
---地点1---
名称：地点名称
描述：地点的详细描述
类型：城市/森林/城堡/秘境/宗门/家族

===角色关系===
---关系1---
角色1：角色1的名字
角色2：角色2的名字
关系：朋友/师徒/宿敌/恋人/亲属
说明：关系描述

===灵感===
---灵感1---
标题：灵感标题
类型：剧情/人物/场景/对白/金句
内容：灵感的具体内容

===参考资料===
---资料1---
名称：资料名称
类型：书籍/文章/纪录片/网站
链接：相关链接（可留空）
说明：参考说明
\`\`\`

## 数量建议
- 章节：10-30 章
- 角色：3-8 个（主角 + 主要配角 + 反派）
- 世界观设定：5-10 条（覆盖不同方面）
- 时间线：5-10 个关键节点
- 地点：5-10 个重要场景
- 角色关系：3-5 对重要关系（必须包含男女主角之间的关系）
- 灵感：3-5 条创作灵感
- 参考资料：2-3 条相关资料（可选）

## 重要提醒
- 平时对话用自然的中文
- 只有在确认创建时才输出 \`\`\`project ... \`\`\` 块
- 严格遵守上述文本格式，每个字段用"字段名：值"的形式
- 列表项用 ---项N--- 分隔
- 不要输出 JSON
- 不要编造用户没提到的关键设定，但可以基于合理推测补充细节并标注为建议
- 保持语气友好、专业、富有创意，像一个真正的创作伙伴`
}

// 解析 AI 输出的项目文本格式
function parseProjectText(text: string): WizardProjectData | null {
  try {
    // 提取 ```project ... ``` 内容
    let content = text
    const codeMatch = text.match(/```project\s*([\s\S]*?)\s*```/)
    if (codeMatch) {
      content = codeMatch[1]
    } else {
      // 兼容：如果没有 ```project 块，尝试找 ===项目信息=== 开头的文本
      const startIdx = text.indexOf('===项目信息===')
      if (startIdx === -1) return null
      content = text.slice(startIdx)
    }

    // 按章节分割
    const sections: Record<string, string> = {}
    const sectionRegex = /===([^=]+)===([\s\S]*?)(?====|$)/g
    let match: RegExpExecArray | null
    while ((match = sectionRegex.exec(content)) !== null) {
      sections[match[1].trim()] = match[2].trim()
    }

    if (Object.keys(sections).length === 0) return null

    // 辅助：解析键值对（值可能跨行）
    const parseKeyValue = (block: string): Record<string, string> => {
      const result: Record<string, string> = {}
      // 匹配 "键：值" 或 "键:值"，值持续到下一个键或块结束
      const lines = block.split('\n')
      let currentKey = ''
      let currentValue = ''

      const saveCurrent = (): void => {
        if (currentKey) {
          result[currentKey] = currentValue.trim()
        }
      }

      for (const line of lines) {
        const kvMatch = line.match(/^([^：:]+)[：:]\s*(.*)$/)
        if (kvMatch && !line.startsWith('---')) {
          // 新的键值对
          saveCurrent()
          currentKey = kvMatch[1].trim()
          currentValue = kvMatch[2] || ''
        } else if (currentKey) {
          // 当前值的延续行
          currentValue += (currentValue ? '\n' : '') + line.trim()
        }
      }
      saveCurrent()
      return result
    }

    // 辅助：解析列表项
    const parseItems = (sectionText: string): Record<string, string>[] => {
      const items: Record<string, string>[] = []
      const itemBlocks = sectionText.split(/---[^-]+---/).filter((s) => s.trim())
      for (const block of items.length ? [sectionText] : []) {
        // unused, fallback below
      }
      // 正确分割：按 ---xxx--- 分割
      const parts = sectionText.split(/---[^-\n]+---/)
      for (const part of parts) {
        if (part.trim()) {
          const kv = parseKeyValue(part)
          if (Object.keys(kv).length > 0) {
            items.push(kv)
          }
        }
      }
      return items
    }

    const data: Partial<WizardProjectData> = {}

    // 项目信息
    if (sections['项目信息']) {
      const info = parseKeyValue(sections['项目信息'])
      data.name = info['名称'] || info['name'] || ''
      data.genre = info['题材'] || info['genre'] || ''
      data.synopsis = info['简介'] || info['synopsis'] || ''
      data.worldBackground = info['世界观背景'] || info['worldBackground'] || ''
    }

    if (!data.name) {
      console.error('[parseProjectText] 未找到项目名称')
      return null
    }

    // 角色
    if (sections['角色']) {
      data.characters = parseItems(sections['角色']).map((c) => ({
        name: c['姓名'] || c['name'] || '',
        description: c['描述'] || c['description'] || '',
        traits: c['特征'] || c['traits'] || '',
        age: parseInt(c['年龄'] || c['age'] || '0', 10) || 0,
        appearance: c['外貌'] || c['appearance'] || '',
        background: c['背景'] || c['background'] || '',
        personality: c['性格'] || c['personality'] || '',
        role: c['定位'] || c['role'] || ''
      }))
    }

    // 章节
    if (sections['章节']) {
      data.chapters = parseItems(sections['章节']).map((ch) => ({
        title: ch['标题'] || ch['title'] || '',
        outline: ch['大纲'] || ch['outline'] || ''
      }))
    }

    // 世界观设定
    if (sections['世界观设定']) {
      data.worldSettings = parseItems(sections['世界观设定']).map((w) => ({
        category: w['分类'] || w['category'] || '',
        key: w['名称'] || w['key'] || '',
        value: w['内容'] || w['value'] || '',
        description: w['说明'] || w['description'] || ''
      }))
    }

    // 时间线
    if (sections['时间线']) {
      data.timelines = parseItems(sections['时间线']).map((t) => ({
        title: t['名称'] || t['title'] || '',
        description: t['描述'] || t['description'] || '',
        date: t['时间'] || t['date'] || ''
      }))
    }

    // 地点
    if (sections['地点']) {
      data.locations = parseItems(sections['地点']).map((l) => ({
        name: l['名称'] || l['name'] || '',
        description: l['描述'] || l['description'] || '',
        type: l['类型'] || l['type'] || ''
      }))
    }

    // 角色关系
    if (sections['角色关系']) {
      data.characterRelations = parseItems(sections['角色关系']).map((r) => ({
        character1Name: r['角色1'] || r['character1Name'] || '',
        character2Name: r['角色2'] || r['character2Name'] || '',
        relation: r['关系'] || r['relation'] || '',
        description: r['说明'] || r['description'] || ''
      }))
    }

    // 灵感
    if (sections['灵感']) {
      data.inspirations = parseItems(sections['灵感']).map((i) => ({
        title: i['标题'] || i['title'] || '',
        type: i['类型'] || i['type'] || '',
        content: i['内容'] || i['content'] || '',
        source: 'AI 生成'
      }))
    }

    // 参考资料
    if (sections['参考资料']) {
      data.references = parseItems(sections['参考资料']).map((r) => ({
        title: r['名称'] || r['title'] || '',
        type: r['类型'] || r['type'] || '',
        url: r['链接'] || r['url'] || '',
        notes: r['说明'] || r['notes'] || ''
      }))
    }

    console.log('[parseProjectText] 解析成功:', data.name, '角色:', data.characters?.length, '章节:', data.chapters?.length)
    return data as WizardProjectData
  } catch (err) {
    console.error('[parseProjectText] 解析异常:', err)
    return null
  }
}

export function registerAIWizardHandlers(): void {
  // 初始化向导会话
  ipcMain.handle('wizard:init', (_event, sessionId: string) => {
    wizardSessions.set(sessionId, {
      messages: [],
      projectData: {},
      step: 0
    })
    return { success: true }
  })

  // 发送消息给 AI 向导
  ipcMain.handle('wizard:send', async (event, sessionId: string, userMessage: string, model?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const session = wizardSessions.get(sessionId)
    if (!session) {
      throw new Error('会话不存在，请重新开始')
    }

    session.messages.push({ role: 'user', content: userMessage })

    const sendChunk = window ? (chunk: string) => window.webContents.send('wizard:chunk', sessionId, chunk) : () => {}

    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }

    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    // 使用传入的模型，如果没有则自动获取
    let selectedModel = model || getCurrentModel()
    if (!selectedModel) {
      selectedModel = await ensureModel(provider)
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: getWizardSystemPrompt() },
      ...session.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    let response: string
    if (provider.type === 'ollama') {
      response = await chatOllama(provider, selectedModel, messages, sendChunk)
    } else {
      response = await chatOpenAIStream(provider, selectedModel, messages, sendChunk)
    }

    session.messages.push({ role: 'assistant', content: response })

    // 解析纯文本格式的项目数据
    const projectData = parseProjectText(response)
    if (projectData) {
      session.projectData = projectData
      console.log('[wizard:send] 解析到项目数据:', projectData.name)
    }

    return {
      content: response,
      hasProjectData: !!projectData,
      projectData
    }
  })

  // 重新生成最后一条回复
  ipcMain.handle('wizard:regenerate', async (event, sessionId: string, model?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const session = wizardSessions.get(sessionId)
    if (!session) {
      throw new Error('会话不存在，请重新开始')
    }

    // 找到最后一条 user 消息
    let lastUserMsg: string | null = null
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') {
        lastUserMsg = session.messages[i].content
        break
      }
    }
    if (!lastUserMsg) {
      throw new Error('没有可重新生成的消息')
    }

    // 移除最后一条 user 和 assistant 消息
    if (session.messages.length >= 2) {
      const last = session.messages[session.messages.length - 1]
      if (last.role === 'assistant') {
        session.messages.pop()
      }
      const last2 = session.messages[session.messages.length - 1]
      if (last2 && last2.role === 'user') {
        session.messages.pop()
      }
    }

    // 重置 projectData
    session.projectData = {}

    const sendChunk = window ? (chunk: string) => window.webContents.send('wizard:chunk', sessionId, chunk) : () => {}

    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    let selectedModel = model || getCurrentModel()
    if (!selectedModel) {
      selectedModel = await ensureModel(provider)
    }

    session.messages.push({ role: 'user', content: lastUserMsg })

    const messages: ChatMessage[] = [
      { role: 'system', content: getWizardSystemPrompt() },
      ...session.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    let response: string
    if (provider.type === 'ollama') {
      response = await chatOllama(provider, selectedModel, messages, sendChunk)
    } else {
      response = await chatOpenAIStream(provider, selectedModel, messages, sendChunk)
    }

    session.messages.push({ role: 'assistant', content: response })

    // 解析纯文本格式的项目数据
    const projectData = parseProjectText(response)
    if (projectData) {
      session.projectData = projectData
      console.log('[wizard:regenerate] 解析到项目数据:', projectData.name)
    }

    return {
      content: response,
      hasProjectData: !!projectData,
      projectData
    }
  })

  // 根据向导数据创建项目
  ipcMain.handle('wizard:createProject', async (_event, sessionId: string, folderPath: string) => {
    const session = wizardSessions.get(sessionId)
    if (!session || !session.projectData) {
      throw new Error('没有可创建的项目数据')
    }

    const data = session.projectData
    if (!data.name) {
      throw new Error('项目名称不能为空')
    }

    // 创建项目
    const projectId = randomUUID()
    const time = now()

    // 处理文件夹路径
    let projectDir = ''
    if (folderPath) {
      const { mkdirSync } = await import('fs')
      const { join } = await import('path')
      projectDir = join(folderPath, data.name.replace(/[<>:"/\\|?*]/g, '_'))
      try {
        mkdirSync(projectDir, { recursive: true })
      } catch (err) {
        console.error('创建项目文件夹失败:', err)
      }
    }

    const project: Project = {
      id: projectId,
      name: data.name,
      description: data.synopsis ? data.synopsis.slice(0, 200) : '',
      synopsis: data.synopsis ?? '',
      path: projectDir,
      genre: data.genre ?? '',
      wordCountTarget: 0,
      status: '构思中',
      worldBackground: data.worldBackground ?? '',
      createdAt: time,
      updatedAt: time
    }
    saveProject(project)

    // 创建章节
    const chapters: Chapter[] = []
    if (data.chapters && data.chapters.length > 0) {
      data.chapters.forEach((ch, index) => {
        const chapterId = randomUUID()
        const chapter: Chapter = {
          id: chapterId,
          projectId,
          title: ch.title,
          content: '',
          outline: ch.outline ?? '',
          sortOrder: index,
          wordCount: 0,
          status: '草稿',
          draftVersion: 1,
          createdAt: time,
          updatedAt: time
        }
        saveChapter(projectId, chapter)
        chapters.push(chapter)
      })
    }

    // 创建角色
    const characters: Character[] = []
    const charMap = new Map<string, string>()
    if (data.characters && data.characters.length > 0) {
      data.characters.forEach((char) => {
        const charId = randomUUID()
        const character: Character = {
          id: charId,
          projectId,
          name: char.name,
          description: char.description ?? '',
          traits: char.traits ?? '',
          age: char.age ?? 0,
          appearance: char.appearance ?? '',
          background: char.background ?? '',
          personality: char.personality ?? '',
          role: char.role ?? '',
          skills: char.skills ?? '',
          relationships: char.relationships ?? '',
          motivation: char.motivation ?? '',
          flaws: char.flaws ?? '',
          growthArc: char.growthArc ?? '',
          createdAt: time,
          updatedAt: time
        }
        saveCharacter(projectId, character)
        characters.push(character)
        charMap.set(char.name, charId)
      })
    }

    // 创建世界观设定
    const worldSettings: WorldSetting[] = []
    if (data.worldSettings && data.worldSettings.length > 0) {
      data.worldSettings.forEach((setting) => {
        const settingId = randomUUID()
        const worldSetting: WorldSetting = {
          id: settingId,
          projectId,
          category: setting.category ?? '',
          key: setting.key ?? '',
          value: setting.value ?? '',
          description: setting.description ?? '',
          rules: setting.rules ?? '',
          relatedSettings: setting.relatedSettings ?? '',
          plotImpact: setting.plotImpact ?? '',
          limitations: setting.limitations ?? '',
          examples: setting.examples ?? '',
          createdAt: time,
          updatedAt: time
        }
        saveWorldSetting(projectId, worldSetting)
        worldSettings.push(worldSetting)
      })
    }

    // 创建时间线
    const timelines: Timeline[] = []
    if (data.timelines && data.timelines.length > 0) {
      data.timelines.forEach((timeline, index) => {
        const timelineId = randomUUID()
        const tl: Timeline = {
          id: timelineId,
          projectId,
          title: timeline.title ?? '',
          description: timeline.description ?? '',
          date: timeline.date ?? '',
          sortOrder: index,
          createdAt: time,
          updatedAt: time
        }
        saveTimeline(projectId, tl)
        timelines.push(tl)
      })
    }

    // 创建地点场景
    const locations: Location[] = []
    if (data.locations && data.locations.length > 0) {
      data.locations.forEach((location) => {
        const locationId = randomUUID()
        const loc: Location = {
          id: locationId,
          projectId,
          name: location.name ?? '',
          description: location.description ?? '',
          type: location.type ?? '',
          createdAt: time,
          updatedAt: time
        }
        saveLocation(projectId, loc)
        locations.push(loc)
      })
    }

    // 创建角色关系（根据角色名匹配 ID）
    const characterRelations: CharacterRelation[] = []
    if (data.characterRelations && data.characterRelations.length > 0 && data.characters && data.characters.length > 0) {
      data.characterRelations.forEach((rel) => {
        const c1Id = charMap.get(rel.character1Name)
        const c2Id = charMap.get(rel.character2Name)
        if (c1Id && c2Id) {
          const relId = randomUUID()
          const relation: CharacterRelation = {
            id: relId,
            projectId,
            characterId1: c1Id,
            characterId2: c2Id,
            relation: rel.relation ?? '',
            description: rel.description ?? '',
            createdAt: time,
            updatedAt: time
          }
          saveCharacterRelation(projectId, relation)
          characterRelations.push(relation)
        }
      })
    }

    // 创建灵感记录
    const inspirations: Inspiration[] = []
    if (data.inspirations && data.inspirations.length > 0) {
      data.inspirations.forEach((ins) => {
        const insId = randomUUID()
        const inspiration: Inspiration = {
          id: insId,
          projectId,
          title: ins.title ?? '',
          content: ins.content ?? '',
          type: ins.type ?? '',
          source: ins.source ?? 'AI 生成',
          createdAt: time,
          updatedAt: time
        }
        saveInspiration(projectId, inspiration)
        inspirations.push(inspiration)
      })
    }

    // 创建参考资料
    const references: Reference[] = []
    if (data.references && data.references.length > 0) {
      data.references.forEach((ref) => {
        const refId = randomUUID()
        const reference: Reference = {
          id: refId,
          projectId,
          title: ref.title ?? '',
          type: ref.type ?? '',
          url: ref.url ?? '',
          notes: ref.notes ?? '',
          createdAt: time,
          updatedAt: time
        }
        saveReference(projectId, reference)
        references.push(reference)
      })
    }

    // 自动补充主角关系：如果男女主角都存在但没有关系，自动添加
    const allChars = characters
    const maleLead = allChars.find(c => c.role && (c.role.includes('男主角') || c.role === '主角' || (c.role.includes('主角') && !c.role.includes('女'))))
    const femaleLead = allChars.find(c => c.role && c.role.includes('女主角'))
    const defaultLead = allChars.find(c => c.role && c.role.includes('主角'))
    const hasRelation = (id1: string, id2: string) =>
      characterRelations.some(r => (r.characterId1 === id1 && r.characterId2 === id2) || (r.characterId1 === id2 && r.characterId2 === id1))

    if (maleLead && femaleLead && !hasRelation(maleLead.id, femaleLead.id)) {
      const relId = randomUUID()
      const relation: CharacterRelation = {
        id: relId,
        projectId,
        characterId1: maleLead.id,
        characterId2: femaleLead.id,
        relation: '恋人',
        description: '男女主角之间的核心情感关系',
        createdAt: time,
        updatedAt: time
      }
      saveCharacterRelation(projectId, relation)
      characterRelations.push(relation)
    } else if (defaultLead && allChars.length >= 2) {
      const other = allChars.find(c => c.id !== defaultLead.id && (c.role?.includes('主') || c.role?.includes('配'))) || allChars.find(c => c.id !== defaultLead.id)
      if (other && !hasRelation(defaultLead.id, other.id)) {
        const relId = randomUUID()
        const relation: CharacterRelation = {
          id: relId,
          projectId,
          characterId1: defaultLead.id,
          characterId2: other.id,
          relation: '伙伴',
          description: '主角与核心角色的重要关系',
          createdAt: time,
          updatedAt: time
        }
        saveCharacterRelation(projectId, relation)
        characterRelations.push(relation)
      }
    }

    // 同步保存到 MD 文件
    console.log('[wizard:createProject] 开始保存 MD 文件, projectDir:', projectDir, 'folderPath:', folderPath, 'projectName:', data.name)
    if (projectDir) {
      try {
        const writingLogs: WritingLog[] = []

        console.log('[wizard:createProject] 数据准备完成:', {
          project: !!project,
          chapters: chapters.length,
          characters: characters.length,
          worldSettings: worldSettings.length,
          timelines: timelines.length,
          locations: locations.length
        })

        saveAllProjectDataMD(
          projectDir,
          project,
          chapters,
          characters,
          worldSettings,
          timelines,
          locations,
          characterRelations,
          inspirations,
          references,
          writingLogs
        )
        console.log('[wizard:createProject] MD 文件保存完成, 路径:', projectDir)
      } catch (err) {
        console.error('[wizard:createProject] 保存 MD 文件失败:', err)
      }
    } else {
      console.warn('[wizard:createProject] projectDir 为空，跳过 MD 文件保存')
    }

    // 清理会话
    wizardSessions.delete(sessionId)

    return { success: true, project }
  })

  // 结束会话
  ipcMain.handle('wizard:end', (_event, sessionId: string) => {
    wizardSessions.delete(sessionId)
    return { success: true }
  })
}

export function registerWorldSettingsHandlers(): void {
  ipcMain.handle('worldSettings:list', (_event, projectId: string) => {
    return loadWorldSettings(projectId).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.key.localeCompare(b.key)
    })
  })

  ipcMain.handle('worldSettings:save', (_event, data: Partial<WorldSetting> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadWorldSettings(data.projectId).find(s => s.id === data.id) : null

    if (existing) {
      const setting: WorldSetting = {
        ...existing,
        category: data.category ?? existing.category,
        key: data.key ?? existing.key,
        value: data.value ?? existing.value,
        description: data.description ?? existing.description,
        rules: data.rules ?? existing.rules,
        relatedSettings: data.relatedSettings ?? existing.relatedSettings,
        plotImpact: data.plotImpact ?? existing.plotImpact,
        limitations: data.limitations ?? existing.limitations,
        examples: data.examples ?? existing.examples,
        updatedAt: time
      }
      saveWorldSetting(data.projectId, setting)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveWorldSettingMD(project.path, setting)
        saveWorldSettingsMD(project.path, loadWorldSettings(data.projectId))
      }

      return setting
    } else {
      const id = data.id || randomUUID()
      const setting: WorldSetting = {
        id,
        projectId: data.projectId,
        category: data.category ?? '',
        key: data.key ?? '',
        value: data.value ?? '',
        description: data.description ?? '',
        rules: data.rules ?? '',
        relatedSettings: data.relatedSettings ?? '',
        plotImpact: data.plotImpact ?? '',
        limitations: data.limitations ?? '',
        examples: data.examples ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveWorldSetting(data.projectId, setting)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveWorldSettingMD(project.path, setting)
        saveWorldSettingsMD(project.path, loadWorldSettings(data.projectId))
      }

      return setting
    }
  })

  ipcMain.handle('worldSettings:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const settings = loadWorldSettings(project.id)
      const setting = settings.find(s => s.id === id)
      if (setting) {
        deleteWorldSetting(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteWorldSettingMD(project.path, setting.category ?? '', setting.key ?? '')
          saveWorldSettingsMD(project.path, loadWorldSettings(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerTimelineHandlers(): void {
  ipcMain.handle('timeline:list', (_event, projectId: string) => {
    return loadTimelines(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('timeline:save', (_event, data: Partial<Timeline> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadTimelines(data.projectId).find(t => t.id === data.id)
      if (!existing) return undefined
      const timeline: Timeline = {
        ...existing,
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        date: data.date ?? existing.date,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveTimeline(data.projectId, timeline)

      // 同步保存到 MD 文件（需要所有时间线数据）
      if (project && project.path) {
        const allTimelines = loadTimelines(data.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        saveTimelineMD(project.path, allTimelines)
      }

      return timeline
    } else {
      const id = randomUUID()
      const timelines = loadTimelines(data.projectId)
      const sortOrder = timelines.length > 0 ? Math.max(...timelines.map(t => t.sortOrder)) + 1 : 0
      const timeline: Timeline = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        description: data.description ?? '',
        date: data.date ?? '',
        sortOrder,
        createdAt: time,
        updatedAt: time
      }
      saveTimeline(data.projectId, timeline)

      // 同步保存到 MD 文件
      if (project && project.path) {
        const allTimelines = loadTimelines(data.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        saveTimelineMD(project.path, allTimelines)
      }

      return timeline
    }
  })

  ipcMain.handle('timeline:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const timelines = loadTimelines(project.id)
      const timeline = timelines.find(t => t.id === id)
      if (timeline) {
        deleteTimeline(project.id, id)
        // 同步保存到 MD 文件（删除后重新生成）
        if (project.path) {
          const allTimelines = loadTimelines(project.id).sort((a, b) => a.sortOrder - b.sortOrder)
          saveTimelineMD(project.path, allTimelines)
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerLocationHandlers(): void {
  ipcMain.handle('location:list', (_event, projectId: string) => {
    return loadLocations(projectId).sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle('location:save', (_event, data: Partial<Location> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadLocations(data.projectId).find(l => l.id === data.id) : null

    if (existing) {
      const location: Location = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        type: data.type ?? existing.type,
        updatedAt: time
      }
      saveLocation(data.projectId, location)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveLocationMD(project.path, location)
        saveLocationsMD(project.path, loadLocations(data.projectId))
      }

      return location
    } else {
      const id = data.id || randomUUID()
      const location: Location = {
        id,
        projectId: data.projectId,
        name: data.name ?? '',
        description: data.description ?? '',
        type: data.type ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveLocation(data.projectId, location)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveLocationMD(project.path, location)
        saveLocationsMD(project.path, loadLocations(data.projectId))
      }

      return location
    }
  })

  ipcMain.handle('location:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const locations = loadLocations(project.id)
      const location = locations.find(l => l.id === id)
      if (location) {
        deleteLocation(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteLocationMD(project.path, location.name)
          saveLocationsMD(project.path, loadLocations(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerCharacterRelationHandlers(): void {
  ipcMain.handle('characterRelation:list', (_event, projectId: string) => {
    return loadCharacterRelations(projectId)
  })

  ipcMain.handle('characterRelation:save', (_event, data: Partial<CharacterRelation> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadCharacterRelations(data.projectId).find(r => r.id === data.id)
      if (!existing) return undefined
      const relation: CharacterRelation = {
        ...existing,
        characterId1: data.characterId1 ?? existing.characterId1,
        characterId2: data.characterId2 ?? existing.characterId2,
        relation: data.relation ?? existing.relation,
        description: data.description ?? existing.description,
        updatedAt: time
      }
      saveCharacterRelation(data.projectId, relation)

      // 同步保存到 MD 文件（需要所有关系数据和角色数据）
      if (project && project.path) {
        const allRelations = loadCharacterRelations(data.projectId)
        const characters = loadCharacters(data.projectId)
        saveCharacterRelationsMD(project.path, allRelations, characters)
      }

      return relation
    } else {
      const id = randomUUID()
      const relation: CharacterRelation = {
        id,
        projectId: data.projectId,
        characterId1: data.characterId1 ?? '',
        characterId2: data.characterId2 ?? '',
        relation: data.relation ?? '',
        description: data.description ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveCharacterRelation(data.projectId, relation)

      // 同步保存到 MD 文件
      if (project && project.path) {
        const allRelations = loadCharacterRelations(data.projectId)
        const characters = loadCharacters(data.projectId)
        saveCharacterRelationsMD(project.path, allRelations, characters)
      }

      return relation
    }
  })

  ipcMain.handle('characterRelation:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const relations = loadCharacterRelations(project.id)
      const relation = relations.find(r => r.id === id)
      if (relation) {
        deleteCharacterRelation(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allRelations = loadCharacterRelations(project.id)
          const characters = loadCharacters(project.id)
          saveCharacterRelationsMD(project.path, allRelations, characters)
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerInspirationHandlers(): void {
  ipcMain.handle('inspiration:list', (_event, projectId: string) => {
    return loadInspirations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('inspiration:save', (_event, data: Partial<Inspiration> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadInspirations(data.projectId).find(i => i.id === data.id)
      if (!existing) return undefined
      const inspiration: Inspiration = {
        ...existing,
        title: data.title ?? existing.title,
        content: data.content ?? existing.content,
        type: data.type ?? existing.type,
        source: data.source ?? existing.source,
        updatedAt: time
      }
      saveInspiration(data.projectId, inspiration)

      // 同步保存到 MD 文件（需要所有灵感数据）
      if (project && project.path && data.projectId) {
        const allInspirations = loadInspirations(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveInspirationsMD(project.path, allInspirations)
      }

      return inspiration
    } else {
      const id = randomUUID()
      const inspiration: Inspiration = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        content: data.content ?? '',
        type: data.type ?? '',
        source: data.source ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveInspiration(data.projectId, inspiration)

      // 同步保存到 MD 文件
      if (project && project.path && data.projectId) {
        const allInspirations = loadInspirations(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveInspirationsMD(project.path, allInspirations)
      }

      return inspiration
    }
  })

  ipcMain.handle('inspiration:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const inspirations = loadInspirations(project.id)
      const inspiration = inspirations.find(i => i.id === id)
      if (inspiration) {
        deleteInspiration(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allInspirations = loadInspirations(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveInspirationsMD(project.path, allInspirations)
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerWritingLogHandlers(): void {
  ipcMain.handle('writingLog:list', (_event, projectId: string) => {
    return loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('writingLog:add', (_event, projectId: string, content: string) => {
    const id = randomUUID()
    const time = now()
    const project = loadProjectById(projectId)

    const log: WritingLog = {
      id,
      projectId,
      content,
      createdAt: time
    }
    saveWritingLog(projectId, log)

    // 同步保存到 MD 文件
    if (project && project.path) {
      const allLogs = loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      saveWritingLogsMD(project.path, allLogs)
    }

    return log
  })

  ipcMain.handle('writingLog:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const logs = loadWritingLogs(project.id)
      const log = logs.find(l => l.id === id)
      if (log) {
        deleteWritingLog(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allLogs = loadWritingLogs(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveWritingLogsMD(project.path, allLogs)
        }
        break
      }
    }
    return { success: true }
  })
}

export function registerReferenceHandlers(): void {
  ipcMain.handle('reference:list', (_event, projectId: string) => {
    return loadReferences(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('reference:save', (_event, data: Partial<Reference> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadReferences(data.projectId).find(r => r.id === data.id)
      if (!existing) return undefined
      const reference: Reference = {
        ...existing,
        title: data.title ?? existing.title,
        type: data.type ?? existing.type,
        url: data.url ?? existing.url,
        notes: data.notes ?? existing.notes,
        updatedAt: time
      }
      saveReference(data.projectId, reference)

      // 同步保存到 MD 文件（需要所有参考资料数据）
      if (project && project.path && data.projectId) {
        const allReferences = loadReferences(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveReferencesMD(project.path, allReferences)
      }

      return reference
    } else {
      const id = randomUUID()
      const reference: Reference = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        type: data.type ?? '',
        url: data.url ?? '',
        notes: data.notes ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveReference(data.projectId, reference)

      // 同步保存到 MD 文件
      if (project && project.path && data.projectId) {
        const allReferences = loadReferences(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveReferencesMD(project.path, allReferences)
      }

      return reference
    }
  })

  ipcMain.handle('reference:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const references = loadReferences(project.id)
      const reference = references.find(r => r.id === id)
      if (reference) {
        deleteReference(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allReferences = loadReferences(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveReferencesMD(project.path, allReferences)
        }
        break
      }
    }
    return { success: true }
  })
}

// ===== 写作风格 =====

export function registerWritingStyleHandlers(): void {
  ipcMain.handle('writingStyle:list', () => {
    return loadWritingStyles().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('writingStyle:save', (_event, data: Partial<WritingStyle>) => {
    const time = now()

    if (data.id) {
      const existing = loadWritingStyles().find(s => s.id === data.id)
      if (!existing) return undefined
      const style: WritingStyle = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        instructions: data.instructions ?? existing.instructions,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    } else {
      const id = randomUUID()
      const sortOrder = getNextWritingStyleSortOrder()
      const style: WritingStyle = {
        id,
        projectId: '',
        name: data.name ?? '',
        description: data.description ?? '',
        instructions: data.instructions ?? '',
        sortOrder,
        createdAt: time,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    }
  })

  ipcMain.handle('writingStyle:delete', (_event, id: string) => {
    deleteWritingStyle(id)
    return { success: true }
  })
}

// ===== 技能 =====

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', () => {
    return loadSkills().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('skill:save', (_event, data: Partial<Skill>) => {
    const time = now()
    if (data.id) {
      const existing = loadSkills().find(s => s.id === data.id)
      if (!existing) return undefined
      const skill: Skill = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        content: data.content ?? existing.content,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveSkill(skill)
      return skill
    } else {
      const id = randomUUID()
      const sortOrder = getNextSkillSortOrder()
      const skill: Skill = {
        id, name: data.name ?? '', description: data.description ?? '',
        category: data.category ?? '', content: data.content ?? '',
        sortOrder, createdAt: time, updatedAt: time
      }
      saveSkill(skill)
      return skill
    }
  })

  ipcMain.handle('skill:delete', (_event, id: string) => {
    deleteSkill(id)
    return { success: true }
  })
}

// ===== 文档内容读取/保存（以 Markdown 原文形式） =====

type DocType = 'project' | 'chapter' | 'character' | 'characters' | 'worldSetting' | 'worldSettings' | 'timeline' | 'location' | 'locations' | 'characterRelations' | 'inspirations' | 'references' | 'writingLogs'

export function registerDocHandlers(): void {
  ipcMain.handle('doc:read', async (_event, projectId: string, docType: DocType, entityId: string) => {
    const project = loadProjectById(projectId)
    if (!project || !project.path) {
      throw new Error('项目不存在或项目路径未设置')
    }
    const projectPath = project.path

    switch (docType) {
      case 'project': {
        const content = readProjectContent(projectPath)
        if (!content && project) {
          saveProjectMD(projectPath, project)
          return readProjectContent(projectPath)
        }
        return content
      }
      case 'chapter': {
        const chapters = loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const chapter = chapters.find(c => c.id === entityId)
        if (!chapter) return ''
        const index = chapters.findIndex((c) => c.id === entityId)
        const content = readChapterContent(projectPath, index, chapter.title)
        if (!content) {
          saveChapterMD(projectPath, chapter, index)
          return readChapterContent(projectPath, index, chapter.title)
        }
        return content
      }
      case 'characters': {
        const characters = loadCharacters(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readCharactersContent(projectPath)
        if (!content && characters.length > 0) {
          saveCharactersMD(projectPath, characters)
          return readCharactersContent(projectPath)
        }
        return content
      }
      case 'character': {
        const character = loadCharacters(projectId).find(c => c.id === entityId)
        if (!character) return ''
        const content = readCharacterContent(projectPath, character.name)
        if (!content) {
          saveCharacterMD(projectPath, character)
          return readCharacterContent(projectPath, character.name)
        }
        return content
      }
      case 'worldSettings': {
        const settings = loadWorldSettings(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readWorldSettingsContent(projectPath)
        if (!content && settings.length > 0) {
          saveWorldSettingsMD(projectPath, settings)
          return readWorldSettingsContent(projectPath)
        }
        return content
      }
      case 'worldSetting': {
        const setting = loadWorldSettings(projectId).find(s => s.id === entityId)
        if (!setting) return ''
        const content = readWorldSettingContent(projectPath, setting.category, setting.key)
        if (!content) {
          saveWorldSettingMD(projectPath, setting)
          return readWorldSettingContent(projectPath, setting.category, setting.key)
        }
        return content
      }
      case 'locations': {
        const locations = loadLocations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readLocationsContent(projectPath)
        if (!content && locations.length > 0) {
          saveLocationsMD(projectPath, locations)
          return readLocationsContent(projectPath)
        }
        return content
      }
      case 'location': {
        const location = loadLocations(projectId).find(l => l.id === entityId)
        if (!location) return ''
        const content = readLocationContent(projectPath, location.name)
        if (!content) {
          saveLocationMD(projectPath, location)
          return readLocationContent(projectPath, location.name)
        }
        return content
      }
      case 'timeline': {
        const timelines = loadTimelines(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const content = readTimelineContent(projectPath)
        if (!content && timelines.length > 0) {
          saveTimelineMD(projectPath, timelines)
          return readTimelineContent(projectPath)
        }
        return content
      }
      case 'characterRelations': {
        const relations = loadCharacterRelations(projectId)
        const characters = loadCharacters(projectId)
        const content = readCharacterRelationsContent(projectPath)
        if (!content && relations.length > 0) {
          saveCharacterRelationsMD(projectPath, relations, characters)
          return readCharacterRelationsContent(projectPath)
        }
        return content
      }
      case 'inspirations': {
        const inspirations = loadInspirations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readInspirationsContent(projectPath)
        if (!content && inspirations.length > 0) {
          saveInspirationsMD(projectPath, inspirations)
          return readInspirationsContent(projectPath)
        }
        return content
      }
      case 'references': {
        const references = loadReferences(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readReferencesContent(projectPath)
        if (!content && references.length > 0) {
          saveReferencesMD(projectPath, references)
          return readReferencesContent(projectPath)
        }
        return content
      }
      case 'writingLogs': {
        const logs = loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readWritingLogsContent(projectPath)
        if (!content && logs.length > 0) {
          saveWritingLogsMD(projectPath, logs)
          return readWritingLogsContent(projectPath)
        }
        return content
      }
      default:
        return ''
    }
  })

  ipcMain.handle('doc:save', async (_event, projectId: string, docType: DocType, entityId: string, content: string) => {
    const project = loadProjectById(projectId)
    if (!project || !project.path) {
      throw new Error('项目不存在或项目路径未设置')
    }
    const projectPath = project.path
    const time = now()

    switch (docType) {
      case 'project': {
        writeProjectContent(projectPath, content)
        const parsed = readProjectMD(projectPath)
        if (parsed && parsed.name) {
          project.name = parsed.name
          project.description = parsed.description ?? project.description
          project.synopsis = parsed.synopsis ?? project.synopsis
          project.genre = parsed.genre ?? project.genre
          project.status = parsed.status ?? project.status
          project.wordCountTarget = parsed.wordCountTarget ?? project.wordCountTarget
          project.worldBackground = parsed.worldBackground ?? project.worldBackground
          project.updatedAt = time
          saveProject(project)
        }
        return { success: true }
      }
      case 'chapter': {
        const chapters = loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const chapter = chapters.find(c => c.id === entityId)
        if (!chapter) return { success: false }
        const index = chapters.findIndex((c) => c.id === entityId)

        const titleMatch = content.match(/^#\s+(.+)/m)
        const outlineMatch = content.match(/## 本章概要\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/)
        const contentMatch = content.match(/## 正文内容\r?\n([\s\S]*?)$/)

        let rawTitle = titleMatch?.[1]?.trim() || chapter.title
        rawTitle = stripChapterTitle(rawTitle)
        const newTitle = rawTitle
        const newOutline = outlineMatch?.[1]?.trim() || ''
        let newContent = contentMatch?.[1]?.trim() || ''
        // 修复旧 bug：正文区域嵌套了完整文档时，提取最里层正文
        const nestedContentIdx = newContent.indexOf('## 正文内容')
        if (nestedContentIdx !== -1) {
          newContent = newContent.substring(nestedContentIdx + 7).trim()
        }

        const oldTitle = stripChapterTitle(chapter.title)
        const oldFileName = `${index + 1}. ${oldTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
        const newFileName = `${index + 1}. ${newTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
        if (oldFileName !== newFileName) {
          const oldPath = join(projectPath, '章节', oldFileName)
          if (existsSync(oldPath)) unlinkSync(oldPath)
        }

        writeChapterContent(projectPath, index, newTitle, content)

        chapter.title = newTitle
        chapter.content = newContent
        chapter.outline = newOutline
        chapter.wordCount = newContent.length
        chapter.updatedAt = time
        saveChapter(projectId, chapter)
        return { success: true, newTitle }
      }
      case 'character': {
        const character = loadCharacters(projectId).find(c => c.id === entityId)
        if (!character) return { success: false }

        const parsed = parseCharacterFromContent(content)
        const newName = parsed.name || character.name

        if (newName !== character.name) {
          deleteCharacterMD(projectPath, character.name)
        }

        writeCharacterContent(projectPath, newName, content)

        character.name = newName
        character.description = parsed.description ?? character.description
        character.traits = parsed.traits ?? character.traits
        character.age = parsed.age ?? character.age
        character.appearance = parsed.appearance ?? character.appearance
        character.background = parsed.background ?? character.background
        character.personality = parsed.personality ?? character.personality
        character.role = parsed.role ?? character.role
        character.updatedAt = time
        saveCharacter(projectId, character)
        return { success: true, newName }
      }
      case 'worldSetting': {
        const setting = loadWorldSettings(projectId).find(s => s.id === entityId)
        if (!setting) return { success: false }

        const catMatch = content.match(/分类[：:]\s*(.+)/)
        const nameMatch = content.match(/^#\s+(.+)/m)
        const valueMatch = content.match(/## 核心内容\s*\n([\s\S]*?)(?=##|$)/)
        const descMatch = content.match(/## 详细说明\s*\n([\s\S]*?)$/)

        const newCategory = catMatch?.[1]?.trim() || setting.category
        const newKey = nameMatch?.[1]?.trim() || setting.key
        const newValue = valueMatch?.[1]?.trim() || ''
        const newDesc = descMatch?.[1]?.trim() || ''

        if (newCategory !== setting.category || newKey !== setting.key) {
          deleteWorldSettingMD(projectPath, setting.category, setting.key)
        }

        writeWorldSettingContent(projectPath, newCategory, newKey, content)

        setting.category = newCategory
        setting.key = newKey
        setting.value = newValue
        setting.description = newDesc
        setting.updatedAt = time
        saveWorldSetting(projectId, setting)
        return { success: true, newKey, newCategory }
      }
      case 'location': {
        const location = loadLocations(projectId).find(l => l.id === entityId)
        if (!location) return { success: false }

        const nameMatch = content.match(/^#\s+(.+)/m)
        const typeMatch = content.match(/类型[：:]\s*(.+)/)
        const descMatch = content.match(/## 描述\s*\n([\s\S]*?)$/)

        const newName = nameMatch?.[1]?.trim() || location.name
        const newType = typeMatch?.[1]?.trim() || ''
        const newDesc = descMatch?.[1]?.trim() || ''

        if (newName !== location.name) {
          deleteLocationMD(projectPath, location.name)
        }

        writeLocationContent(projectPath, newName, content)

        location.name = newName
        location.description = newDesc
        location.type = newType
        location.updatedAt = time
        saveLocation(projectId, location)
        return { success: true, newName }
      }
      case 'locations': {
        writeLocationsContent(projectPath, content)
        const parsedLocations = parseLocationsFromMD(content)
        for (const p of parsedLocations) {
          const existing = loadLocations(projectId).find(l => l.id === p.id)
          if (existing) {
            existing.name = p.name || existing.name
            existing.type = p.type || existing.type
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveLocation(projectId, existing)
          } else if (p.id) {
            saveLocation(projectId, {
              id: p.id,
              projectId,
              name: p.name || '',
              type: p.type || '',
              description: p.description || '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      case 'characters': {
        writeCharactersContent(projectPath, content)
        const parsedChars = parseCharactersFromMD(content)
        for (const p of parsedChars) {
          const existing = loadCharacters(projectId).find(c => c.id === p.id)
          if (existing) {
            existing.name = p.name || existing.name
            existing.role = p.role || existing.role
            existing.age = p.age || existing.age
            existing.traits = p.traits || existing.traits
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveCharacter(projectId, existing)
          } else if (p.id) {
            saveCharacter(projectId, {
              id: p.id,
              projectId,
              name: p.name || '',
              role: p.role || '',
              age: p.age || 0,
              traits: p.traits || '',
              description: p.description || '',
              appearance: '',
              background: '',
              personality: '',
              skills: '',
              relationships: '',
              motivation: '',
              flaws: '',
              growthArc: '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      case 'worldSettings': {
        writeWorldSettingsContent(projectPath, content)
        const parsedSettings = parseWorldSettingsFromMD(content)
        for (const p of parsedSettings) {
          const existing = loadWorldSettings(projectId).find(s => s.id === p.id)
          if (existing) {
            existing.key = p.key || existing.key
            existing.category = p.category || existing.category
            existing.value = p.value || existing.value
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveWorldSetting(projectId, existing)
          } else if (p.id) {
            saveWorldSetting(projectId, {
              id: p.id,
              projectId,
              key: p.key || '',
              category: p.category || '',
              value: p.value || '',
              description: p.description || '',
              rules: '',
              relatedSettings: '',
              plotImpact: '',
              limitations: '',
              examples: '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      default:
        return { success: false, message: '该文档类型暂不支持从 MD 同步到数据库' }
    }
  })
}

function parseCharacterFromContent(content: string): Partial<Character> {
  const nameMatch = content.match(/^#\s+(.+)/m)
  const idMatch = content.match(/ID[：:]\s*(.+)/)
  const roleMatch = content.match(/\*\*角色定位\*\*[：:]\s*(.+)/)
  const ageMatch = content.match(/\*\*年龄\*\*[：:]\s*(.+)/)
  const appearanceMatch = content.match(/## 外貌描写\s*\n([\s\S]*?)(?=##|$)/)
  const personalityMatch = content.match(/## 性格特点\s*\n([\s\S]*?)(?=##|$)/)
  const traitsMatch = content.match(/### 性格特征\s*\n([\s\S]*?)(?=##|$)/)
  const backgroundMatch = content.match(/## 背景故事\s*\n([\s\S]*?)(?=##|$)/)
  const descMatch = content.match(/## 简要描述\s*\n([\s\S]*?)(?=##|$)/)

  return {
    id: idMatch?.[1]?.trim() || '',
    name: nameMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || '',
    age: parseInt(ageMatch?.[1]?.trim() || '0') || 0,
    appearance: appearanceMatch?.[1]?.trim() || '',
    personality: personalityMatch?.[1]?.trim() || '',
    traits: traitsMatch?.[1]?.trim() || '',
    background: backgroundMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || ''
  }
}

// ===== AI 资产生成（根据类型生成角色/世界观/时间线/地点/关系/灵感/参考资料）=====

type AssetType = 'character' | 'world' | 'timeline' | 'location' | 'relation' | 'inspiration' | 'reference' | 'character-batch' | 'world-batch' | 'timeline-batch' | 'location-batch' | 'relation-batch' | 'inspiration-batch' | 'reference-batch' | 'chapter-outline'

interface GenerateAssetRequest {
  type: AssetType
  projectId: string
  context: {
    name: string
    genre: string
    synopsis: string
    worldBackground: string
    characters: { name: string; role?: string; description?: string }[]
    worldSettings: { category: string; key: string; value: string }[]
    locations: { name: string; type?: string }[]
    chapterTitle?: string
    chapterContent?: string
  }
  hint?: string  // 用户附加的提示
  count?: number // 批量生成数量
}

function buildAssetPrompt(req: GenerateAssetRequest): { system: string; user: string } {
  const ctx = req.context
  const ctxLines: string[] = []
  if (ctx.name) ctxLines.push(`项目名：${ctx.name}`)
  if (ctx.genre) ctxLines.push(`题材：${ctx.genre}`)
  if (ctx.synopsis) ctxLines.push(`故事大纲：\n${ctx.synopsis}`)
  if (ctx.worldBackground) ctxLines.push(`世界观背景：\n${ctx.worldBackground}`)
  if (ctx.characters?.length > 0) {
    ctxLines.push(`已有角色：\n${ctx.characters.map(c => `- ${c.name}${c.role ? `（${c.role}）` : ''}：${c.description ?? ''}`).join('\n')}`)
  }
  if (ctx.worldSettings?.length > 0) {
    ctxLines.push(`已有世界观：\n${ctx.worldSettings.map(w => `- [${w.category}] ${w.key}：${w.value}`).join('\n')}`)
  }
  if (ctx.locations?.length > 0) {
    ctxLines.push(`已有地点：\n${ctx.locations.map(l => `- ${l.name}${l.type ? `（${l.type}）` : ''}`).join('\n')}`)
  }
  if (ctx.chapterTitle) {
    ctxLines.push(`章节标题：${ctx.chapterTitle}`)
  }
  const contextText = ctxLines.join('\n\n')

  const count = req.count ?? (req.type.endsWith('-batch') ? 5 : 1)

  const prompts: Record<AssetType, { system: string; user: string }> = {
    'character': {
      system: '你是一位专业的小说创作助手，擅长塑造立体的角色。请根据项目上下文生成一个角色，严格遵循统一的角色设定模板。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一个角色，严格使用以下 JSON 格式（不要任何额外文字、不要使用 markdown 代码块）。角色设定必须完整覆盖所有字段，确保角色立体丰满：\n{"name":"角色名","role":"角色定位（如：主角/配角/反派）","age":年龄数字,"appearance":"外貌描写（详细，包含身高、发型、服饰、特征）","personality":"性格特点（详细，包含正面与负面特质）","background":"背景故事（包含出身、成长经历、关键事件）","description":"一句话角色描述","traits":"性格特征（多个用逗号分隔）","skills":"能力技能（包含天赋、擅长领域、特殊能力）","relationships":"人际关系（与其他角色的关系）","motivation":"目标与动机（角色追求什么，为什么）","flaws":"弱点缺陷（性格弱点、能力短板、心理创伤）","growthArc":"成长弧线（角色在故事中的成长变化）"}`
    },
    'world': {
      system: '你是一位专业的小说世界观设计师。请根据项目上下文生成一条世界观设定，严格遵循统一的世界观设定模板。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一条世界观设定，严格使用以下 JSON 格式。设定必须完整覆盖所有字段，逻辑严谨，具有可操作性：\n{"category":"分类（如：魔法体系/社会制度/科技水平/宗教信仰/地理环境/历史背景）","key":"设定名称","value":"设定的核心内容（简洁明了的核心规则）","description":"详细说明（完整的设定描述）","rules":"规则体系（设定的具体规则、限制条件、运作方式）","relatedSettings":"相关设定（与其他设定的关联）","plotImpact":"对剧情的影响（该设定如何影响故事发展）","limitations":"限制条件（设定的边界和约束）","examples":"示例案例（该设定在故事中的具体应用场景）"}`
    },
    'timeline': {
      system: '你是一位专业的小说时间线策划师。请根据项目上下文生成一个时间节点。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一个时间节点，严格使用以下 JSON 格式：\n{"title":"时间节点名称","date":"时间（如：故事开始前 100 年）","description":"该时间发生的事件描述"}`
    },
    'location': {
      system: '你是一位专业的小说场景设计师。请根据项目上下文生成一个地点。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一个地点，严格使用以下 JSON 格式：\n{"name":"地点名称","type":"地点类型（如：城市/森林/城堡/秘境）","description":"地点的详细描述，包括地理特征、氛围、与剧情的关系"}`
    },
    'relation': {
      system: '你是一位专业的小说角色关系分析师。请根据项目上下文生成角色之间的关系。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一条角色关系，严格使用以下 JSON 格式（characterId1/characterId2 必须是已有角色名）：\n{"characterId1":"角色1的名字","characterId2":"角色2的名字","relation":"关系类型（如：朋友/师徒/宿敌/恋人/亲属）","description":"关系描述"}`
    },
    'inspiration': {
      system: '你是一位富有创意的小说构思师。请根据项目上下文生成一条创作灵感。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一条灵感，严格使用以下 JSON 格式：\n{"title":"灵感标题","type":"灵感类型（如：剧情/人物/场景/对白/金句）","content":"灵感的具体内容","source":"灵感来源（可填 AI 生成）"}`
    },
    'reference': {
      system: '你是一位专业的小说参考资料整理员。请根据项目题材和背景推荐相关参考资料。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出一条参考资料，严格使用以下 JSON 格式：\n{"title":"资料名称（如：相关书籍/历史资料/专业知识）","type":"资料类型（如：书籍/文章/纪录片/网站）","url":"相关链接（可留空）","notes":"为什么参考此资料的说明"}`
    },
    'character-batch': {
      system: '你是一位专业的小说创作助手，擅长塑造立体的角色阵容。请根据项目上下文生成多个角色，严格遵循统一的角色设定模板。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 个角色，组成一个角色阵容（包含主角、重要配角、反派等），严格使用以下 JSON 数组格式。每个角色必须完整覆盖所有字段，确保角色立体丰满：\n[{"name":"角色名","role":"角色定位","age":年龄数字,"appearance":"外貌描写（详细）","personality":"性格特点（详细）","background":"背景故事（详细）","description":"一句话角色描述","traits":"性格特征","skills":"能力技能","relationships":"人际关系","motivation":"目标与动机","flaws":"弱点缺陷","growthArc":"成长弧线"},...]`
    },
    'world-batch': {
      system: '你是一位专业的小说世界观设计师。请根据项目上下文生成多条世界观设定，严格遵循统一的世界观设定模板。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 条世界观设定，覆盖不同方面（魔法/社会/科技/地理/宗教/历史等），严格使用以下 JSON 数组格式。每条设定必须完整覆盖所有字段，逻辑严谨：\n[{"category":"分类","key":"设定名称","value":"核心内容","description":"详细说明","rules":"规则体系","relatedSettings":"相关设定","plotImpact":"对剧情的影响","limitations":"限制条件","examples":"示例案例"},...]`
    },
    'timeline-batch': {
      system: '你是一位专业的小说时间线策划师。请根据项目上下文生成多个时间节点。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 个时间节点，构成完整的故事时间线，严格使用以下 JSON 数组格式：\n[{"title":"时间节点","date":"时间","description":"事件描述"},...]`
    },
    'location-batch': {
      system: '你是一位专业的小说场景设计师。请根据项目上下文生成多个地点。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 个故事中的重要地点，严格使用以下 JSON 数组格式：\n[{"name":"地点名称","type":"地点类型","description":"详细描述"},...]`
    },
    'inspiration-batch': {
      system: '你是一位富有创意的小说构思师。请根据项目上下文生成多条创作灵感。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 条灵感（剧情、人物、场景、对白等），严格使用以下 JSON 数组格式：\n[{"title":"灵感标题","type":"灵感类型","content":"灵感内容","source":"灵感来源（可填 AI 生成）"},...]`
    },
    'relation-batch': {
      system: '你是一位专业的小说角色关系分析师。请根据项目上下文生成角色之间的关系网络。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n现有角色：\n${req.context.characters?.map(c => `- ${c.name}（${c.role || '未知定位'}）`).join('\n') || '无'}\n\n请输出 ${count} 对角色关系，必须包含男女主角之间的关系，严格使用以下 JSON 数组格式：\n[{"characterId1":"角色1名字","characterId2":"角色2名字","relation":"关系类型（朋友/师徒/宿敌/恋人/亲属/对手/恩人）","description":"关系详细描述"},...]`
    },
    'reference-batch': {
      system: '你是一位专业的小说参考资料整理员。请根据项目题材和背景推荐相关参考资料。',
      user: `${contextText}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请输出 ${count} 条参考资料，严格使用以下 JSON 数组格式：\n[{"title":"资料名称","type":"资料类型","url":"相关链接（可留空）","notes":"参考说明"},...]`
    },
    'chapter-outline': {
      system: '你是一位专业的小说编辑与策划师，擅长从已有正文提炼结构化大纲。请根据给定的章节正文，按照 specs/章纲格式规范.md 定义的模板生成本章详细大纲。',
      user: `${contextText}\n\n章节正文：\n${ctx.chapterContent || '（无正文）'}${req.hint ? `\n\n用户要求：${req.hint}` : ''}\n\n请基于以上正文，生成该章节的结构化章纲。每个字段都要根据正文内容填写，不要留空。只输出大纲内容，不要包含任何额外说明或代码块。\n\n### 章节信息\n- 编号：[数字]\n- 标题：[章节标题]\n- 时间：[故事内时间]\n- 地点：[主要场景]\n- 出场人物：[人物列表]\n- 视角人物：[视角角色]\n\n### 本章目标\n[一句话概括本章目的]\n\n### 本章剧情概述\n[2-4段叙述性文字概述全章]\n\n### 剧情流程\n1. [剧情点1]\n2. [剧情点2]\n3. [剧情点3]\n4. [剧情点4]\n5. [剧情点5]\n\n### 本章冲突\n- 外部冲突：[描述]\n- 内部冲突：[描述]\n- 人际冲突：[描述]\n\n### 人物变化\n- [角色A]：[变化]\n- [角色B]：[变化]\n\n### 释放信息\n1. [信息1]\n2. [信息2]\n\n### 埋下伏笔\n1. [伏笔1]\n2. [伏笔2]\n\n### 本章情绪基调\n[关键词]\n\n### 本章看点/爽点/泪点\n- 看点：[看点]\n- 爽点：[爽点]\n- 泪点：[泪点]\n\n### 章节结尾钩子\n[一句话悬念]\n\n### 承接上一章\n[衔接说明]\n\n### 引出下一章\n[预告说明]\n\n### 描写重点\n[描写要点]\n\n### 预计字数\n本章正文约[N]字\n\n### 备注\n[注意事项]`
    }
  }
  return prompts[req.type]
}

function extractJson(text: string): unknown {
  // 优先匹配 ```json ... ``` 块
  const fence = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fence) {
    try { return JSON.parse(fence[1]) } catch { /* fall through */ }
  }
  // 否则尝试从文本中提取 JSON 数组或对象
  const arrMatch = text.match(/\[[\s\S]*\]/)
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]) } catch { /* fall through */ }
  }
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch { /* fall through */ }
  }
  return null
}

export function registerAIAssetHandlers(): void {
  ipcMain.handle('ai:generateAsset', async (_event, req: GenerateAssetRequest) => {
    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = await ensureModel(provider)
    const { system, user } = buildAssetPrompt(req)

    let result: string
    if (provider.type === 'ollama') {
      result = await chatOllama(provider, model, [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ])
    } else {
      result = await chatOpenAI(provider, model, [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ])
    }

    // chapter-outline 返回纯文本大纲，不做 JSON 解析
    if (req.type === 'chapter-outline') {
      // 去除可能被模型误加的 ``` 代码块包裹
      const cleaned = result.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      return { data: { outline: cleaned } }
    }

    const parsed = extractJson(result)
    if (parsed === null) {
      return { error: 'AI 返回格式不正确', raw: result }
    }
    return { data: parsed }
  })
}
