import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Loader2, Check, MessageSquare, Sparkles, ChevronDown, RefreshCw } from 'lucide-react'
import { useAppStore, type Character, type WorldSetting, type Location, type Timeline, type CharacterRelation, type Inspiration, type Reference } from '../../store/app'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const ENTITY_CONFIG: Record<string, {
  label: string
  systemPrompt: string
  fields: string
  saveFieldMap: string[]
}> = {
  character: {
    label: '角色',
    systemPrompt: '你是一位小说创作助手，帮助用户创建和修改角色。',
    fields: 'name（姓名）, gender（性别）, age（年龄数字）, dynasty（朝代）, birthplace（籍贯）, role（身份定位如"主角"/"配角"）, heightBuild（身材）, appearance（外貌描写）, face（面容）, hairstyle（发型）, clothing（衣着）, personality（性格特点）, background（背景故事）, description（简要描述）, traits（性格特征）, skills（技能）, talents（才艺专长）, likes（喜好厌恶）, importantEvents（重要经历）, relationshipsDetail（人际关系）, weaknesses（性格弱点）, specialMarks（特殊标记）',
    saveFieldMap: ['name', 'gender', 'age', 'dynasty', 'birthplace', 'role', 'appearance', 'heightBuild', 'face', 'hairstyle', 'clothing', 'personality', 'background', 'description', 'traits', 'skills', 'talents', 'likes', 'importantEvents', 'relationshipsDetail', 'weaknesses', 'specialMarks']
  },
  worldSetting: {
    label: '世界观设定',
    systemPrompt: '你是一位小说创作助手，帮助用户创建和修改世界观设定。',
    fields: 'category（分类如"魔法体系"/"社会结构"）, key（设定名称）, value（核心内容）, description（详细说明）',
    saveFieldMap: ['category', 'key', 'value', 'description']
  },
  location: {
    label: '地点',
    systemPrompt: '你是一位小说创作助手，帮助用户创建和修改地点场景。',
    fields: 'name（地点名称）, type（类型如"城市"/"森林"/"建筑"）, description（描述）',
    saveFieldMap: ['name', 'type', 'description']
  },
  chapterOutline: {
    label: '章纲',
    systemPrompt: '你是一位专业的小说编辑与策划师，擅长帮用户构思章节大纲。请严格按照 specs/章纲格式规范.md 的完整模板输出。',
    fields: 'number（章节编号，阿拉伯数字）, title（章节标题）, time（故事内时间）, location（主要场景地点）, characters（出场人物列表）, pov（视角人物，仅一个）, goal（本章目标）, overview（本章剧情概述，2-4段）, plot（剧情流程，编号列表，至少5条）, conflict（冲突，含外部/内部/人际）, characterChange（人物变化，含角色和变化描述）, infoRelease（释放信息，编号列表）, foreshadow（埋下伏笔，编号列表）, mood（本章情绪基调）, highlight（看点/爽点/泪点，三项）, hook（章节结尾钩子）, prevChapter（承接上一章）, nextChapter（引出下一章）, focus（描写重点）, wordCount（预计字数，格式如"本章正文约8000-10000字"）, notes（备注，可选）',
    saveFieldMap: ['number', 'title', 'time', 'location', 'characters', 'pov', 'goal', 'overview', 'plot', 'conflict', 'characterChange', 'infoRelease', 'foreshadow', 'mood', 'highlight', 'hook', 'prevChapter', 'nextChapter', 'focus', 'wordCount', 'notes']
  }
}

function buildSystemPrompt(entityType: string, existingList: string): string {
  const cfg = ENTITY_CONFIG[entityType]
  if (!cfg) return '你是一位小说创作助手。'

  return `你是一位小说创作助手，帮助用户通过对话创建和修改${cfg.label}。

现有${cfg.label}列表：
${existingList || '（暂无）'}

## 核心规则（必须严格遵守）

每当用户要求创建或修改${cfg.label}时，你的回答必须同时包含两部分：

**第一部分**：用自然语言回复用户，说明你做了什么。

**第二部分**：在回答的最后，把 ${cfg.label} 的数据用 JSON 数组放在 \`\`\`json 代码块中。除此之外，回答中不要出现其他 JSON 内容。

**两个部分缺一不可！**

## JSON 字段说明

${cfg.fields}

## 字段要求

- **\`name\`（或角色的名称字段）必须始终包含在 JSON 中**，这是匹配已有条目的关键
- 其他字段按需填写即可，不填的字段会被保留原值
- 不需要 \`id\` 字段，系统会自动按名称匹配

## 示例

\`\`\`json
[{"name": "林清雅", "gender": "女", "age": 18, "dynasty": "大雍朝", "birthplace": "江南苏州府", "role": "女主角", "heightBuild": "身高约五尺三寸，身姿纤柔，腰肢盈盈一握", "appearance": "容貌秀丽，肌肤胜雪，眉目如画", "face": "鹅蛋脸，柳叶眉，杏眼含春，肤如凝脂", "hairstyle": "乌黑长发及腰，常挽云髻，插碧玉簪", "clothing": "多着青色或月白色襦裙，绣兰花纹样，佩玉佩香囊", "personality": "温婉恬静，知书达理，心思细腻，外柔内刚", "background": "苏州林家大小姐，书香门第，父亲为翰林学士", "description": "官宦千金，大家闺秀，擅长琴棋书画", "traits": "温婉恬静，知书达理，心思细腻，外柔内刚", "skills": "琴棋书画，尤精古琴", "talents": "琴艺高超，通晓诗词歌赋，精通女红刺绣，略懂医理药理", "likes": "喜好：抚琴、读书、赏花、品茗、雨后漫步。喜爱之物：《花间集》、白瓷茶具、紫竹笛。厌恶：虚伪做作之人、喧嚣吵闹", "importantEvents": "十岁时母亲病逝；十五岁参加诗会一曲《平沙落雁》技惊四座；十七岁时父亲被贬随父离京赴任", "relationshipsDetail": "父亲林文渊（翰林学士，严慈相济）；贴身丫鬟春杏（自幼相伴，情同姐妹）；表兄苏瑾言（青梅竹马，世交之谊）", "weaknesses": "过于心软易被人利用真心；身体柔弱不耐风寒；过分在意他人看法", "specialMarks": "左手腕有月牙形胎记；幼时落水后惧怕深水"}]
\`\`\`

现在，请严格按照以上规则回复用户的消息。`
}

function parseJsonBlocks(content: string): Record<string, unknown>[] | null {
  // 优先匹配 ```json ... ``` 代码块
  const regex = /```(?:json)?\s*([\s\S]*?)```/g
  const matches: Record<string, unknown>[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (Array.isArray(parsed)) {
        matches.push(...parsed)
      } else {
        matches.push(parsed)
      }
    } catch { }
  }
  if (matches.length > 0) return matches

  // 回退：尝试把整个响应解析为 JSON（处理纯 JSON 响应）
  try {
    const parsed = JSON.parse(content.trim())
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
  } catch { }

  return null
}

interface AIChatDialogProps {
  open: boolean
  onClose: () => void
  entityType: 'character' | 'worldSetting' | 'location' | 'chapterOutline'
  projectId: string
  chapterId?: string
}

export default function AIChatDialog({ open, onClose, entityType, projectId, chapterId }: AIChatDialogProps): JSX.Element | null {
  const { characters, worldSettings, locations, saveCharacter, saveWorldSetting, saveLocation, loadCharacters, loadWorldSettings, loadLocations, saveChapterOutline } = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEntities, setPendingEntities] = useState<Record<string, unknown>[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [applyDone, setApplyDone] = useState(false)
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const streamContentRef = useRef('')

  const getExistingList = useCallback((): string => {
    switch (entityType) {
      case 'character':
        return characters.map(c => `- ${c.name}（${c.role || '-'}）`).join('\n')
      case 'worldSetting':
        return worldSettings.map(s => `- ${s.key}（${s.category || '-'}）`).join('\n')
      case 'location':
        return locations.map(l => `- ${l.name}（${l.type || '-'}）`).join('\n')
      case 'chapterOutline':
        return ''
      default:
        return ''
    }
  }, [entityType, characters, worldSettings, locations])

  useEffect(() => {
    if (!open) {
      cleanupRef.current?.()
      return
    }

    const existingList = getExistingList()
    const sysPrompt = buildSystemPrompt(entityType, existingList)

    const cfg = ENTITY_CONFIG[entityType]
    const chapterLabel = entityType === 'chapterOutline' ? '章纲' : (cfg?.label || '内容')
    const exampleMsg = entityType === 'chapterOutline'
      ? '- "帮我写第3章的章纲，这章主角要突破瓶颈"\n- "为第5章生成一个悬念章纲"\n- "修改第2章的章纲，增加一个冲突场景"'
      : `- "创建一个${cfg?.label ? `名叫XX的${cfg.label}` : '新内容'}"\n- "把XX的年龄改成25"\n- "帮我生成3个${cfg?.label || '内容'}"`
    const initialMsg: ChatMessage = {
      role: 'assistant',
      content: `你好！我可以帮你创建或修改${chapterLabel}。\n\n你可以这样跟我说：\n${exampleMsg}\n\n直接描述你的需求即可！`
    }

    setMessages([
      { role: 'system', content: sysPrompt },
      initialMsg
    ])
    setInput('')
    setLoading(false)
    setPendingEntities(null)
    setApplyDone(false)
    setApplyError('')
    streamContentRef.current = ''

    // 加载模型列表
    setIsLoadingModels(true)
    window.api.getCurrentConfig?.().then((cfg: { model?: string }) => {
      if (cfg?.model) setSelectedModel(cfg.model)
    }).catch(() => {})
    window.api.listModels?.().then((list: { id: string; name: string }[]) => {
      if (list && Array.isArray(list)) {
        setModels(list)
        if (list.length > 0 && !selectedModel) setSelectedModel(list[0].id)
      }
    }).catch(() => {}).finally(() => setIsLoadingModels(false))

    return () => {
      cleanupRef.current?.()
    }
  }, [open, entityType])

  // 点击外部关闭模型下拉
  useEffect(() => {
    if (!showModelDropdown) return
    const close = () => setShowModelDropdown(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [showModelDropdown])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const doSend = async (userMsg: string): Promise<void> => {
    if (!userMsg.trim() || loading) return

    setInput('')
    setPendingEntities(null)
    setApplyDone(false)
    setApplyError('')

    const userContent = userMsg.trim()
    const displayMessages: ChatMessage[] = [...messages, { role: 'user', content: userContent }]
    setMessages(displayMessages)
    setLoading(true)
    streamContentRef.current = ''

    // 发送给 API 时在用户消息末尾追加强制指令，确保 AI 输出 JSON
    const apiMessages: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content:
          userContent +
          '\n\n【强制要求】你的回答末尾必须输出一个 ```json 代码块，' +
          '其中**必须包含 name 字段**（用于匹配现有条目），其他字段按需填写。' +
          '如果没有这个代码块，你的回答将被视为无效。现在请开始回答。'
      }
    ]

    const chunkCleanup = window.api.onAiChunk?.((chunk: string) => {
      streamContentRef.current += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: streamContentRef.current }
          return updated
        }
        return [...prev, { role: 'assistant' as const, content: streamContentRef.current }]
      })
    })

    cleanupRef.current = chunkCleanup ?? null

    try {
        const result = await window.api.aiChat(apiMessages, { stream: true, model: selectedModel || undefined })
      if (result) {
        streamContentRef.current = result
        setMessages((prev) => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: result }
          } else {
            updated.push({ role: 'assistant', content: result })
          }
          return updated
        })
        let parsed = parseJsonBlocks(result)
        // 如果 AI 回复中没有 JSON，自动追问让 AI 只输出 JSON
        if (!parsed || parsed.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 300))
          const followUpMessages: ChatMessage[] = [
            ...apiMessages,
            { role: 'assistant', content: result },
            {
              role: 'user',
              content:
                '请把刚才的修改数据用 JSON 数组放在 ```json 代码块中输出，不要其他文字。'
            }
          ]
          const jsonResult = await window.api.aiChat(followUpMessages, { stream: false, model: selectedModel || undefined })
          if (jsonResult) {
            parsed = parseJsonBlocks(jsonResult)
          }
        }
        if (parsed && parsed.length > 0) {
          setPendingEntities(parsed)
        } else {
          // AI 仍然没有输出 JSON，保留 pendingEntities 为 null
        }
      }
    } catch (err) {
      console.error('AI chat error:', err)
      setMessages((prev) => [...prev, { role: 'assistant', content: '抱歉，请求失败：' + (err instanceof Error ? err.message : String(err)) }])
    } finally {
      setLoading(false)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }

  const handleSend = (): void => {
    doSend(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApply = async (): Promise<void> => {
    if (!pendingEntities || pendingEntities.length === 0 || applying) return
    setApplying(true)
    setApplyError('')

    try {
      let saved = 0
      for (const entity of pendingEntities) {
        const id = entity.id as string | undefined
        const name = entity.name as string | undefined

        if (!name && !id) continue

        switch (entityType) {
          case 'character': {
            const name = entity.name as string | undefined
            const existing = name ? characters.find(c => c.name === name) : null
            await saveCharacter({
              id: existing?.id || id || undefined,
              projectId,
              name: name || existing?.name || '',
              role: (entity.role as string) || existing?.role || '',
              age: (entity.age as number) ?? existing?.age ?? 0,
              appearance: (entity.appearance as string) || existing?.appearance || '',
              personality: (entity.personality as string) || existing?.personality || '',
              background: (entity.background as string) || existing?.background || '',
              description: (entity.description as string) || existing?.description || '',
              traits: (entity.traits as string) || existing?.traits || '',
              skills: (entity.skills as string) || existing?.skills || '',
              relationships: (entity.relationships as string) || existing?.relationships || '',
              motivation: (entity.motivation as string) || existing?.motivation || '',
              flaws: (entity.flaws as string) || existing?.flaws || '',
              growthArc: (entity.growthArc as string) || existing?.growthArc || '',
              gender: (entity.gender as string) || existing?.gender || '',
              dynasty: (entity.dynasty as string) || existing?.dynasty || '',
              birthplace: (entity.birthplace as string) || existing?.birthplace || '',
              heightBuild: (entity.heightBuild as string) || existing?.heightBuild || '',
              face: (entity.face as string) || existing?.face || '',
              hairstyle: (entity.hairstyle as string) || existing?.hairstyle || '',
              clothing: (entity.clothing as string) || existing?.clothing || '',
              talents: (entity.talents as string) || existing?.talents || '',
              likes: (entity.likes as string) || existing?.likes || '',
              importantEvents: (entity.importantEvents as string) || existing?.importantEvents || '',
              relationshipsDetail: (entity.relationshipsDetail as string) || existing?.relationshipsDetail || '',
              weaknesses: (entity.weaknesses as string) || existing?.weaknesses || '',
              specialMarks: (entity.specialMarks as string) || existing?.specialMarks || ''
            })
            break
          }
          case 'worldSetting': {
            const key = entity.key as string | undefined
            const existing = key ? worldSettings.find(s => s.key === key) : null
            await saveWorldSetting({
              id: existing?.id || id || undefined,
              projectId,
              category: (entity.category as string) || existing?.category || '',
              key: key || existing?.key || '',
              value: (entity.value as string) || existing?.value || '',
              description: (entity.description as string) || existing?.description || ''
            })
            break
          }
          case 'location': {
            const name = entity.name as string | undefined
            const existing = name ? locations.find(l => l.name === name) : null
            await saveLocation({
              id: existing?.id || id || undefined,
              projectId,
              name: name || existing?.name || '',
              type: (entity.type as string) || existing?.type || '',
              description: (entity.description as string) || existing?.description || ''
            })
            break
          }
          case 'chapterOutline': {
            if (!chapterId) {
              setApplyError('未指定目标章节')
              setApplying(false)
              return
            }
            const num = entity.number as string | undefined
            const title = entity.title as string | undefined
            const time = entity.time as string | undefined
            const loc = entity.location as string | undefined
            const chars = entity.characters as string | undefined
            const pov = entity.pov as string | undefined
            const goal = entity.goal as string | undefined
            const overview = entity.overview as string | undefined
            const plot = entity.plot as string | undefined
            const conflict = entity.conflict as string | undefined
            const charChange = entity.characterChange as string | undefined
            const infoRelease = entity.infoRelease as string | undefined
            const foreshadow = entity.foreshadow as string | undefined
            const mood = entity.mood as string | undefined
            const highlight = entity.highlight as string | undefined
            const hook = entity.hook as string | undefined
            const prevChapter = entity.prevChapter as string | undefined
            const nextChapter = entity.nextChapter as string | undefined
            const focus = entity.focus as string | undefined
            const wordCount = entity.wordCount as string | undefined
            const notes = entity.notes as string | undefined

            const parts: string[] = []
            parts.push('### 章节信息')
            if (num) parts.push(`- 编号：${num}`)
            if (title) parts.push(`- 标题：${title}`)
            if (time) parts.push(`- 时间：${time}`)
            if (loc) parts.push(`- 地点：${loc}`)
            if (chars) parts.push(`- 出场人物：${chars}`)
            if (pov) parts.push(`- 视角人物：${pov}`)
            if (goal) parts.push(`\n### 本章目标\n${goal}`)
            if (overview) parts.push(`\n### 本章剧情概述\n${overview}`)
            if (plot) parts.push(`\n### 剧情流程\n${plot}`)
            if (conflict) parts.push(`\n### 本章冲突\n${conflict}`)
            if (charChange) parts.push(`\n### 人物变化\n${charChange}`)
            if (infoRelease) parts.push(`\n### 释放信息\n${infoRelease}`)
            if (foreshadow) parts.push(`\n### 埋下伏笔\n${foreshadow}`)
            if (mood) parts.push(`\n### 本章情绪基调\n${mood}`)
            if (highlight) parts.push(`\n### 本章看点/爽点/泪点\n${highlight}`)
            if (hook) parts.push(`\n### 章节结尾钩子\n${hook}`)
            if (prevChapter) parts.push(`\n### 承接上一章\n${prevChapter}`)
            if (nextChapter) parts.push(`\n### 引出下一章\n${nextChapter}`)
            if (focus) parts.push(`\n### 描写重点\n${focus}`)
            if (wordCount) parts.push(`\n### 预计字数\n${wordCount}`)
            if (notes) parts.push(`\n### 备注\n${notes}`)

            await saveChapterOutline(chapterId, parts.join('\n'))
            break
          }
        }
        saved++
      }

      setApplyDone(true)
      setApplyError(saved === 0 ? '没有可保存的项' : '')
      // 刷新 store 以更新面板
      try {
        if (entityType === 'character') await loadCharacters(projectId)
        else if (entityType === 'worldSetting') await loadWorldSettings(projectId)
        else if (entityType === 'location') await loadLocations(projectId)
      } catch { /* ignore refresh errors */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setApplyError('保存失败：' + msg)
      console.error('Apply error:', err)
    } finally {
      setApplying(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-[600px] h-[500px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              AI 对话创建{ENTITY_CONFIG[entityType]?.label || ''}
            </h2>
            {/* 模型选择器 */}
            <div className="relative ml-2">
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                disabled={loading || isLoadingModels}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  minWidth: 100
                }}
              >
                {isLoadingModels ? (
                  <RefreshCw size={10} className="animate-spin" />
                ) : (
                  <>
                    <span className="truncate">{selectedModel || '选择模型'}</span>
                    <ChevronDown size={10} />
                  </>
                )}
              </button>
              {showModelDropdown && (
                <div
                  className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden min-w-[160px]"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {models.length > 0 ? (
                    <div className="py-1">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedModel(m.id); setShowModelDropdown(false) }}
                          className="w-full px-3 py-1.5 text-left text-xs transition-colors"
                          style={{
                            color: m.id === selectedModel ? 'var(--color-accent)' : 'var(--color-text)',
                            backgroundColor: m.id === selectedModel ? 'var(--color-accent-light)' : 'transparent'
                          }}
                          onMouseEnter={e => { if (m.id !== selectedModel) e.currentTarget.style.backgroundColor = 'var(--color-hover)' }}
                          onMouseLeave={e => { if (m.id !== selectedModel) e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          {m.name || m.id}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无可用模型</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="icon-btn" style={{ width: 24, height: 24 }} disabled={loading}>
            <X size={14} />
          </button>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-auto p-3 space-y-3" style={{ backgroundColor: 'var(--color-surface)' }}>
          {messages.filter(m => m.role !== 'system').map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed"
                style={{
                  backgroundColor: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-sidebar)',
                  color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                  border: msg.role === 'assistant' ? '1px solid var(--color-border-light)' : 'none',
                }}
              >
                <pre className="whitespace-pre-wrap m-0" style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                  {msg.content || (loading && i === messages.filter(m => m.role !== 'system').length - 1 ? '思考中...' : '')}
                </pre>
              </div>
            </div>
          ))}

          {/* 提示：检测到 AI 回答了但没有 JSON，引导用户说得更具体 */}
          {!pendingEntities && !loading && messages.filter(m => m.role === 'assistant').length > 1 && (
            <div className="flex justify-center">
              <div
                className="rounded-lg px-3 py-1.5 text-xs"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}
              >
                要让 AI 创建或修改{ENTITY_CONFIG[entityType]?.label || '内容'}，请描述具体需求，例如"创建一个名叫小明的角色，他是个勇敢的少年"
              </div>
            </div>
          )}

          {/* 待应用实体 */}
          {pendingEntities && pendingEntities.length > 0 && !loading && (
            <div className="flex justify-center">
              <div
                className="rounded-lg px-4 py-2 text-xs space-y-1"
                style={{
                  backgroundColor: applyDone ? 'rgba(34,197,94,0.1)' : 'var(--color-accent-light)',
                  border: applyDone ? '1px solid rgb(34,197,94)' : '1px solid var(--color-accent)'
                }}
              >
                <p style={{ color: applyDone ? 'rgb(34,197,94)' : 'var(--color-accent)' }} className="font-medium">
                  <Sparkles size={12} className="inline mr-1" />
                  {applyDone
                    ? `已保存 ${pendingEntities.length} 项${ENTITY_CONFIG[entityType]?.label || '内容'}到项目`
                    : `检测到 ${pendingEntities.length} 项${ENTITY_CONFIG[entityType]?.label || '内容'}`
                  }
                </p>
                {pendingEntities.map((e, i) => (
                  <p key={i} style={{ color: 'var(--color-text)' }}>
                    {e.name as string || e.key as string || `项 ${i + 1}`}
                  </p>
                ))}
                {!applyDone && (
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="mt-2 px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: 'white',
                      border: 'none',
                      cursor: applying ? 'not-allowed' : 'pointer',
                      opacity: applying ? 0.6 : 1,
                    }}
                  >
                    {applying ? (
                      <><Loader2 size={12} className="animate-spin" /> 应用中...</>
                    ) : (
                      <><Check size={12} /> 应用到项目</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          {applyError && !loading && (
            <div className="flex justify-center">
              <div
                className="rounded-lg px-4 py-2 text-xs"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  color: 'var(--color-danger)',
                  border: '1px solid rgba(239,68,68,0.3)'
                }}
              >
                {applyError}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? 'AI 正在思考...' : '描述你想创建或修改的内容...（Enter 发送，Shift+Enter 换行）'}
              className="textarea flex-1 resize-none text-sm"
              rows={2}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="btn btn-primary flex items-center gap-1.5 h-9"
              style={{ minWidth: 70 }}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <><Send size={14} /><span>发送</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
