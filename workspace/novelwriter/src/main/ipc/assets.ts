import { randomUUID } from 'crypto'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  Project, Chapter, Character, WorldSetting, Timeline, Location, Item, Dialogue, CharacterRelation, Inspiration, WritingLog, Reference, WritingStyle, Skill,
  loadProjects, saveProject, deleteProject, loadProjectById,
  loadStoryProgress, saveStoryProgress,
  loadChapters, saveChapter, deleteChapter,
  loadCharacters, saveCharacter, deleteCharacter,
  loadWorldSettings, saveWorldSetting, deleteWorldSetting,
  loadTimelines, saveTimeline, deleteTimeline,
  loadLocations, saveLocation, deleteLocation,
  loadItems, saveItem, deleteItem,
  loadDialogues, saveDialogue, deleteDialogue,
  loadCharacterRelations, saveCharacterRelation, deleteCharacterRelation,
  loadCharacterPositions, saveCharacterPositions,
  loadInspirations, saveInspiration, deleteInspiration,
  loadWritingLogs, saveWritingLog, deleteWritingLog,
  loadReferences, saveReference, deleteReference,
  loadWritingStyles, saveWritingStyle, deleteWritingStyle, getNextWritingStyleSortOrder,
  loadSkills, saveSkill, deleteSkill, getNextSkillSortOrder,
  loadAIProviders
} from '../fileStorage'
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
} from '../ai'
import type { ChatMessage } from '../ai'
import type { AIProvider } from '../fileStorage'
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
} from '../markdownStorage'
import { now, extractTitleFromBody, extractTitleFromBodyMD, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges } from './helpers'



export function parseCharacterFromContent(content: string): Partial<Character> {
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
  providerId?: string // 可选：指定供应商，不传则用活跃供应商
  model?: string // 可选：指定模型，不传则用供应商保存的模型
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
    if (req.providerId) {
      provider = loadAIProviders().find(p => p.id === req.providerId) ?? provider
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = req.model || await ensureModel(provider)
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
