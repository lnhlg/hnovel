// ===================== AI Prompt 模板（主进程侧唯一收敛处） =====================
// 所有主进程内联的 AI prompt 集中于此，避免散落各处难以同步。
// 修改任何模板时，请同步检查：
//   - specs/章纲格式规范.md（章纲字段约定）
//   - 渲染端 AIChatDialog.tsx 的 ENTITY_CONFIG（实体对话 systemPrompt/字段）
//   - 解析端（ipc/aiOutline.ts planChapters、ipc/assets.ts extractJson、ipc/wizard.ts parseProjectText）
//
// PROMPT_VERSION 用于标识当前模板代次，改模板结构时递增；后续可接入 prompt 实验/回滚。

import {
  loadProjectById,
  loadStoryProgress,
  loadChapters,
  loadCharacters,
  loadItems,
  loadTimelines,
  loadDialogues,
  loadCharacterRelations,
  loadWorldSettings,
  loadWritingStyles,
  loadSkills
} from './fileStorage'

export const PROMPT_VERSION = '2026-07'

// ===== 生成章节正文 =====

export interface GenerateChapterPromptOptions {
  projectId: string
  synopsis: string
  chapterTitle: string
  chapterOutline: string
  previousChapters: { title: string; content: string }[]
}

export function buildGenerateChapterPrompt(opts: GenerateChapterPromptOptions): string {
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

  return prompt
}

// ===== 规划章节列表 =====

export interface PlanChaptersPromptOptions {
  synopsis: string
  numChapters: number
}

export function buildPlanChaptersPrompt(opts: PlanChaptersPromptOptions): string {
  return `你是一位专业的小说编辑。请根据以下小说大纲，规划 ${opts.numChapters} 章的章节安排。

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
}

// ===== AI 引导式项目创建（向导） =====

export function getWizardSystemPrompt(): string {
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

// ===== AI 资产生成（按类型） =====

export type AssetType = 'character' | 'world' | 'timeline' | 'location' | 'relation' | 'inspiration' | 'reference' | 'character-batch' | 'world-batch' | 'timeline-batch' | 'location-batch' | 'relation-batch' | 'inspiration-batch' | 'reference-batch' | 'chapter-outline'

export interface GenerateAssetRequest {
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
  requestId?: string // 可选：用于中止生成
}

export function buildAssetPrompt(req: GenerateAssetRequest): { system: string; user: string } {
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
