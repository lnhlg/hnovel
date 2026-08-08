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
