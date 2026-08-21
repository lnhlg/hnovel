import { randomUUID } from 'crypto'
import { ipcMain, BrowserWindow } from 'electron'
import {
  Project, Chapter, Character, WorldSetting, Timeline, Location, CharacterRelation, Inspiration, WritingLog, Reference, saveProject, saveChapter, saveCharacter, saveWorldSetting, saveTimeline, saveLocation, saveCharacterRelation, saveInspiration, saveReference,
  loadAIProviders
} from '../fileStorage'
import {
  getActiveProvider,
  getCurrentModel,
  chatOpenAIStream,
  chatOllama,
  loadActiveProvider,
  registerAbortController,
  releaseAbortController
} from '../ai'
import type { ChatMessage } from '../ai'
import {
  saveAllProjectDataMD
} from '../markdownStorage'
import { now, ensureModel } from './helpers'
import { getWizardSystemPrompt } from '../prompts'



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
  characters: { name: string; description: string; traits: string; age: number; appearance: string; background: string; personality: string; role: string; skills?: string; relationships?: string; motivation?: string; flaws?: string; growthArc?: string }[]
  worldSettings: { category: string; key: string; value: string; description: string; rules?: string; relatedSettings?: string; plotImpact?: string; limitations?: string; examples?: string }[]
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

// 会话数上限：超限时淘汰最旧的（Map 按插入序），防止长期运行内存增长
const MAX_WIZARD_SESSIONS = 20

function upsertWizardSession(sessionId: string, session: { messages: WizardMessage[]; projectData: Partial<WizardProjectData>; step: number }): void {
  if (wizardSessions.size >= MAX_WIZARD_SESSIONS && !wizardSessions.has(sessionId)) {
    const oldestKey = wizardSessions.keys().next().value
    if (oldestKey !== undefined) wizardSessions.delete(oldestKey)
  }
  wizardSessions.set(sessionId, session)
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
    upsertWizardSession(sessionId, {
      messages: [],
      projectData: {},
      step: 0
    })
    return { success: true }
  })

  // 发送消息给 AI 向导
  ipcMain.handle('wizard:send', async (event, sessionId: string, userMessage: string, model?: string, providerId?: string, requestId?: string) => {
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
    if (providerId) {
      provider = loadAIProviders().find(p => p.id === providerId) ?? provider
    }

    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    // 使用传入的模型，如果没有则自动获取
    let selectedModel = model || provider.model || (provider.id === getActiveProvider()?.id ? getCurrentModel() : '')
    if (!selectedModel) {
      selectedModel = await ensureModel(provider)
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: getWizardSystemPrompt() },
      ...session.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    let response: string
    const rid = requestId || randomUUID()
    const abortController = new AbortController()
    registerAbortController(rid, abortController)
    try {
      if (provider.type === 'ollama') {
        response = await chatOllama(provider, selectedModel, messages, sendChunk, abortController.signal)
      } else {
        response = await chatOpenAIStream(provider, selectedModel, messages, sendChunk, abortController.signal)
      }
    } finally {
      releaseAbortController(rid)
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
  ipcMain.handle('wizard:regenerate', async (event, sessionId: string, model?: string, providerId?: string, requestId?: string) => {
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
    if (providerId) {
      provider = loadAIProviders().find(p => p.id === providerId) ?? provider
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    let selectedModel = model || provider.model || (provider.id === getActiveProvider()?.id ? getCurrentModel() : '')
    if (!selectedModel) {
      selectedModel = await ensureModel(provider)
    }

    session.messages.push({ role: 'user', content: lastUserMsg })

    const messages: ChatMessage[] = [
      { role: 'system', content: getWizardSystemPrompt() },
      ...session.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    let response: string
    const rid = requestId || randomUUID()
    const abortController = new AbortController()
    registerAbortController(rid, abortController)
    try {
      if (provider.type === 'ollama') {
        response = await chatOllama(provider, selectedModel, messages, sendChunk, abortController.signal)
      } else {
        response = await chatOpenAIStream(provider, selectedModel, messages, sendChunk, abortController.signal)
      }
    } finally {
      releaseAbortController(rid)
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
      storyProgress: '',
      writingStyleId: '',
      skillId: '',
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
          storyProgressSynced: 0,
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
          gender: '',
          dynasty: '',
          birthplace: '',
          heightBuild: '',
          face: '',
          hairstyle: '',
          clothing: '',
          talents: '',
          likes: '',
          importantEvents: '',
          relationshipsDetail: '',
          weaknesses: '',
          specialMarks: '',
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
          chapterId: '',
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
