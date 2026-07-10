import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, Check, ChevronDown, ChevronRight, User, Package, Building2, Route, MapPin, HeartHandshake, Eye, MessageSquare, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useLayoutStore } from '../../store/layout'
import ModelSelector from '../ModelSelector'

interface Props {
  open: boolean
  onClose: () => void
  sourceText: string
  projectId: string
  chapterTitle?: string
  chapterId?: string
}

interface ExtractedCharacter {
  name: string
  description: string
  appearance: string
  clothing: string
  personality: string
  status: string
  time: string
  location: string
}

interface ExtractedItem {
  name: string
  description: string
  status: string
  owner: string
  time: string
  location: string
}

interface ExtractedOrg {
  name: string
  description: string
  status: string
  time: string
  location: string
}

interface ExtractedRelation {
  character1: string
  character2: string
  relation: string
  description: string
}

interface ExtractedCharItem {
  character: string
  item: string
  relation: string
  description: string
}

interface ExtractedCharOrg {
  character: string
  organization: string
  relation: string
  description: string
}

interface ExtractedLocation {
  name: string
  description: string
  type: string
}

interface ExtractedDialogue {
  speaker: string
  content: string
  context: string
  with: string
}

interface ExtractedEvent {
  name: string
  description: string
  time: string
  location: string
  participants: string[]
}

interface MemoryData {
  characters: ExtractedCharacter[]
  items: ExtractedItem[]
  organizations: ExtractedOrg[]
  relationships: ExtractedRelation[]
  characterItems: ExtractedCharItem[]
  characterOrgs: ExtractedCharOrg[]
  dialogues: ExtractedDialogue[]
  locations: ExtractedLocation[]
  events: ExtractedEvent[]
}

function parseAIResponse(raw: string): MemoryData {
  const empty: MemoryData = {
    characters: [], items: [], organizations: [],
    relationships: [], characterItems: [], characterOrgs: [],
    dialogues: [], locations: [], events: []
  }

  let clean = raw.trim()
  const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) clean = fence[1].trim()

  try {
    const parsed = JSON.parse(clean)
    if (parsed && typeof parsed === 'object') {
      return {
        characters: Array.isArray(parsed.characters) ? parsed.characters.filter((c: any) => c?.name) : [],
        items: Array.isArray(parsed.items) ? parsed.items.filter((i: any) => i?.name) : [],
        organizations: Array.isArray(parsed.organizations) ? parsed.organizations.filter((o: any) => o?.name) : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships.filter((r: any) => r?.character1 && r?.character2) : [],
        characterItems: Array.isArray(parsed.characterItems) ? parsed.characterItems.filter((ci: any) => ci?.character && ci?.item) : [],
        characterOrgs: Array.isArray(parsed.characterOrgs) ? parsed.characterOrgs.filter((co: any) => co?.character && co?.organization) : [],
        dialogues: Array.isArray(parsed.dialogues) ? parsed.dialogues.filter((d: any) => d?.speaker && d?.content) : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations.filter((l: any) => l?.name) : [],
        events: Array.isArray(parsed.events) ? parsed.events.filter((e: any) => e?.name) : []
      }
    }
  } catch {}

  const arrMatch = clean.match(/\[\s*\{[\s\S]+?\}\s*\]/)
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0])
      if (Array.isArray(arr) && arr.length > 0 && arr[0].name) {
        return { ...empty, characters: arr.filter((c: any) => c?.name) }
      }
    } catch {}
  }

  return empty
}

const sectionConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  characters: { label: '人物', icon: <User size={14} />, color: '#3b82f6' },
  items: { label: '物品', icon: <Package size={14} />, color: '#f59e0b' },
  organizations: { label: '组织', icon: <Building2 size={14} />, color: '#8b5cf6' },
  relationships: { label: '人物关系', icon: <HeartHandshake size={14} />, color: '#ec4899' },
  characterItems: { label: '人物-物品关系', icon: <Package size={14} />, color: '#f97316' },
  characterOrgs: { label: '人物-组织关系', icon: <Building2 size={14} />, color: '#a855f7' },
  dialogues: { label: '重要对话', icon: <MessageSquare size={14} />, color: '#6b7280' },
  locations: { label: '地点', icon: <MapPin size={14} />, color: '#10b981' },
  events: { label: '事件', icon: <Route size={14} />, color: '#f97316' }
}

export default function ExtractMemoryDialog({ open, onClose, sourceText, projectId, chapterTitle: propChapterTitle, chapterId }: Props): JSX.Element | null {
  const currentProject = useAppStore((s) => s.currentProject)
  const saveCharacter = useAppStore((s) => s.saveCharacter)
  const saveLocation = useAppStore((s) => s.saveLocation)
  const saveWorldSetting = useAppStore((s) => s.saveWorldSetting)
  const saveTimeline = useAppStore((s) => s.saveTimeline)
  const saveCharacterRelation = useAppStore((s) => s.saveCharacterRelation)
  const saveItem = useAppStore((s) => s.saveItem)
  const loadCharacters = useAppStore((s) => s.loadCharacters)
  const loadItems = useAppStore((s) => s.loadItems)
  const loadLocations = useAppStore((s) => s.loadLocations)
  const loadWorldSettings = useAppStore((s) => s.loadWorldSettings)
  const loadTimelines = useAppStore((s) => s.loadTimelines)
  const loadCharacterRelations = useAppStore((s) => s.loadCharacterRelations)
  const characters = useAppStore((s) => s.characters)
  const characterRelations = useAppStore((s) => s.characterRelations)
  const locations = useAppStore((s) => s.locations)
  const worldSettings = useAppStore((s) => s.worldSettings)
  const timelines = useAppStore((s) => s.timelines)
  const chatModel = useAppStore((s) => s.chatModel)
  const chatProviderId = useAppStore((s) => s.chatProviderId)
  const chatReasoningEffort = useAppStore((s) => s.chatReasoningEffort)
  const setChatModel = useAppStore((s) => s.setChatModel)
  const setChatProviderId = useAppStore((s) => s.setChatProviderId)
  const setChatReasoningEffort = useAppStore((s) => s.setChatReasoningEffort)

  const [data, setData] = useState<MemoryData | null>(null)
  const [extractModel, setExtractModel] = useState(chatModel)
  const [extractProviderId, setExtractProviderId] = useState(chatProviderId)
  const [extractEffort, setExtractEffort] = useState<'low' | 'medium' | 'high' | 'max'>(chatReasoningEffort)
  const [showEffortDropdown, setShowEffortDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, Set<number>>>({})

  const chapterTitle = propChapterTitle || ''
  const chMarker = chapterId ? `[ch:${chapterId}]` : ''

  const handleExtract = async () => {
    if (!sourceText.trim() || loading) return
    setLoading(true)
    setError('')
    setData(null)
    setCollapsed({})
    setChecked({})

    try {
      const chapterContent = sourceText.slice(0, 30000)
      const messages = [
        {
          role: 'system' as const,
          content: `你是一个严格的小说记忆提取助手。从用户提供的章节正文中提取记忆信息，以 JSON 格式返回。

JSON 结构如下（每个分类都是数组，无数据则返回空数组 []）：

1. characters（人物）：name（姓名）、description（简介）、appearance（外貌）、clothing（服饰）、personality（性格）、status（当前状态，如受伤/昏迷/愤怒/喜悦等）、time（出现时间）、location（出现地点）
2. items（物品）：name（名称）、description（描述+外形+大小）、status（状态，如破损/遗失/使用中）、owner（持有者）、time（出现时间）、location（出现地点）
3. organizations（组织）：name（名称）、description（描述）、status（当前状态）、time（出现时间）、location（所在地）。**军队/门派/家族/朝廷/国家/帮派等都属于组织**
4. relationships（人物关系）：character1（角色A）、character2（角色B）、relation（关系类型）、description（关系描述）
5. characterItems（人物-物品关系）：character（人物名）、item（物品名）、relation（关系类型）、description（关系描述）
6. characterOrgs（人物-组织关系）：character（人物名）、organization（组织名）、relation（关系类型）、description（关系描述）
7. dialogues（重要对话）：speaker（说话者）、content（对话内容）、context（对话背景/场景）、with（对话对象，如'众人'或具体角色名）
8. locations（地点）：name（名称）、description（描述）、type（类型）
9. events（事件）：name（事件名）、description（描述）、time（发生时间）、location（发生地点）、participants（参与角色列表）

【关键约束】
- 只提取本章正文中**明确出现**的信息，绝不编造
- relationships：根据本章正文中角色之间的**任何互动或关联**来记录关系。包括但不限于：对话、交手、命令与服从、汇报、同行、协作、亲属称谓、主仆、师徒、同门、上下级等。即使没有直接对话，只要两个角色在本章中同时出现且有关联，就记录他们的关系。例如：将军给士兵下命令→"统属"；两人一起行动→"同伴"；A称B为师父→"师徒"；A对B行礼→"主从"
- characterItems：角色在本章中**涉及**的任何物品都记录。包括：持有、使用、佩戴、携带、丢失、损坏、赠送等。例如：角色拔剑→"持有·剑"；角色戴玉佩→"佩戴·玉佩"
- characterOrgs：角色在本章中**关联**的任何组织都记录，**军队/门派/家族/朝廷/国家等都属于组织**。包括：隶属、加入、离开、统领、对抗、敌对、结盟等。例如：角色与蒙古军交战→"敌对→蒙古军"；角色是丐帮弟子→"弟子·丐帮"；角色自称朝廷命官→"官员→朝廷"
- 关系类型要准确：用"统属"代替"上下级"，用"战友"代替"同伴"，用"师徒"代替"老师"
- 描述内容简洁（20字内）
- 只输出 JSON，不要其他文字`
        },
        {
          role: 'user' as const,
          content: `以下是小说「${currentProject?.name || ''}」的章节正文，请提取所有记忆信息：\n\n${chapterContent}`
        }
      ]

      const result = await window.api.aiChat(messages, { stream: false, model: extractModel || undefined, providerId: extractProviderId || undefined, reasoningEffort: extractEffort })
      if (!result) { setError('AI 未返回结果'); return }

      const parsed = parseAIResponse(result)
      setData(parsed)

      const initialChecked: Record<string, Set<number>> = {}
      const initialCollapsed: Record<string, boolean> = {}
      for (const key of Object.keys(parsed) as (keyof MemoryData)[]) {
        const arr = parsed[key]
        if (Array.isArray(arr) && arr.length > 0) {
          initialChecked[key] = new Set(arr.map((_, i) => i))
          initialCollapsed[key] = false
        }
      }
      setChecked(initialChecked)
      setCollapsed(initialCollapsed)
    } catch (err) {
      setError('提取失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleItem = (section: string, idx: number) => {
    setChecked(prev => {
      const set = new Set(prev[section] || [])
      if (set.has(idx)) set.delete(idx)
      else set.add(idx)
      return { ...prev, [section]: set }
    })
  }

  const toggleAll = (section: string, arr: any[]) => {
    setChecked(prev => {
      const current = prev[section] || new Set()
      const allSelected = current.size === arr.length
      if (allSelected) {
        return { ...prev, [section]: new Set() }
      } else {
        return { ...prev, [section]: new Set(arr.map((_, i) => i)) }
      }
    })
  }

  const countSelected = (): number => {
    let total = 0
    for (const set of Object.values(checked)) {
      total += set.size
    }
    return total
  }

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      const ctx = chapterTitle ? `（${chapterTitle}）${chMarker}` : chMarker
      const existingCharNames = new Set(characters.map(c => c.name.trim()))

      for (const idx of checked.characters || []) {
        const c = data.characters[idx]
        if (!c) continue
        if (existingCharNames.has(c.name.trim())) {
          const existing = characters.find(ch => ch.name.trim() === c.name.trim())
          if (existing) {
            const statusEntry = c.status ? `${ctx} 状态: ${c.status}` : ''
            const prevEvents = existing.importantEvents || ''
            await saveCharacter({
              id: existing.id,
              projectId,
              description: existing.description || c.description || '',
              appearance: existing.appearance || c.appearance || '',
              personality: existing.personality || c.personality || '',
              clothing: existing.clothing || c.clothing || '',
              importantEvents: statusEntry
                ? (prevEvents ? `${prevEvents}\n${statusEntry}` : statusEntry)
                : prevEvents
            })
          }
        } else {
          await saveCharacter({
            projectId,
            name: c.name,
            description: c.description || '',
            appearance: c.appearance || '',
            personality: c.personality || '',
            clothing: c.clothing || '',
            importantEvents: c.status ? `${ctx} 状态: ${c.status}` : '',
            role: '', age: 0, background: '', traits: '',
            skills: '', relationships: '', motivation: '', flaws: '', growthArc: '',
            gender: '', dynasty: '', birthplace: '', heightBuild: '',
            face: '', hairstyle: '', talents: '', likes: '',
            relationshipsDetail: '', weaknesses: '', specialMarks: ''
          })
        }
      }

      const existingLocationNames = new Set(locations.map(l => l.name.trim()))
      for (const idx of checked.locations || []) {
        const l = data.locations[idx]
        if (!l) continue
        if (!existingLocationNames.has(l.name.trim())) {
            await saveLocation({
              projectId,
              name: l.name,
              description: (l.description || '') + ctx,
              type: l.type || '其他'
            })
        }
      }

      // 重新从 store 读取角色列表（含刚新建的角色），用于关系保存
      const freshChars = useAppStore.getState().characters
      const charNameToId = new Map(freshChars.map(c => [c.name.trim(), c.id]))

      for (const idx of checked.relationships || []) {
        const r = data.relationships[idx]
        if (!r) continue
        await saveCharacterRelation({
          projectId,
          characterId1: charNameToId.get(r.character1.trim()) || '',
          characterId2: charNameToId.get(r.character2.trim()) || '',
          relation: r.relation || '',
          description: (r.description || '') + (ctx ? ` ${ctx}` : '')
        })
      }

      const existingWorldMap = new Map(worldSettings.map(w => [w.key.trim(), w]))

      try {
        for (const idx of checked.items || []) {
          const item = data.items[idx]
          if (!item) continue
          const existing = useAppStore.getState().items.find(i => i.name === item.name.trim() && i.chapterId === chapterId)
          if (existing) {
            if (existing.status !== (item.status || '')) {
              await saveItem({ id: existing.id, projectId, name: item.name.trim(), status: item.status || '', description: item.description || '', owner: item.owner || '', chapterId: chapterId || '', appearance: item.appearance || '', size: '', pattern: '' })
            }
          } else {
            await saveItem({ projectId, name: item.name.trim(), description: item.description || '', status: item.status || '', owner: item.owner || '', chapterId: chapterId || '', appearance: item.appearance || '', size: '', pattern: '' })
          }
        }
      } catch (e) { console.error('物品保存失败（不影响其他数据）:', e) }

      for (const idx of checked.organizations || []) {
        const org = data.organizations[idx]
        if (!org) continue
        const key = org.name.trim()
        const newDesc = `状态: ${org.status || '未知'}${org.time ? ` | 出现于: ${org.time}` : ''}${org.location ? ` | 地点: ${org.location}` : ''}${ctx}`
        const existing = existingWorldMap.get(key)
        if (existing && existing.category === '组织') {
          const oldStatus = existing.description.match(/状态:\s*([^\s|]+)/)?.[1]
          if (oldStatus && oldStatus !== (org.status || '未知')) {
            await saveWorldSetting({ id: existing.id, projectId, category: '组织', key, value: org.description || '', description: newDesc })
          }
        } else if (!existing) {
          await saveWorldSetting({ projectId, category: '组织', key, value: org.description || '', description: newDesc })
        }
      }

      for (const idx of checked.characterItems || []) {
        const ci = data.characterItems[idx]
        if (!ci) continue
        const key = `${ci.character.trim()}→${ci.item.trim()}@${chapterId || 'gen'}`
        await saveWorldSetting({
          projectId,
          category: '人物-物品关系',
          key,
          value: ci.relation || '',
          description: (ci.description || '') + ctx
        })
      }

      for (const idx of checked.characterOrgs || []) {
        const co = data.characterOrgs[idx]
        if (!co) continue
        const key = `${co.character.trim()}→${co.organization.trim()}@${chapterId || 'gen'}`
        await saveWorldSetting({
          projectId,
          category: '人物-组织关系',
          key,
          value: co.relation || '',
          description: (co.description || '') + ctx
        })
      }

      let evSeq = 0
      for (const idx of checked.events || []) {
        const ev = data.events[idx]
        if (!ev) continue
        await saveTimeline({
          projectId,
          title: ev.name.trim(),
          description: `${ev.description || ''}${ev.location ? `\n地点: ${ev.location}` : ''}${ev.participants?.length ? `\n参与角色: ${ev.participants.join(', ')}` : ''}${ctx}[seq:${evSeq}]`,
          date: ev.time || '',
          chapterId: chapterId || '',
          sortOrder: evSeq
        })
        evSeq++
      }

      let seq = 0
      for (const idx of checked.dialogues || []) {
        const d = data.dialogues[idx]
        if (!d) continue
        const suffix = chapterId ? `@${chapterId}` : ''
        const key = `${d.speaker.trim()}→${(d.with || '未知').trim()}${suffix}`
        await saveWorldSetting({ projectId, category: '重要对话', key, value: d.content || '', description: `${d.context || ''}${ctx}[seq:${seq}]` })
        seq++
      }

      await loadCharacters(projectId)
      await loadLocations(projectId)
      await loadItems(projectId)
      await loadWorldSettings(projectId)
      await loadTimelines(projectId)
      await loadCharacterRelations(projectId)
      useLayoutStore.getState().refreshMemoryGraph()
      onClose()
    } catch (err) {
      setError('保存失败：' + (err instanceof Error ? err.message : String(err)))
      setTimeout(() => onClose(), 2000)
    } finally {
      setSaving(false)
    }
  }

  const sectionKeys = data
    ? (Object.keys(sectionConfig) as (keyof MemoryData)[]).filter(k => Array.isArray(data[k]) && data[k].length > 0)
    : []

  const renderFields = (item: any) => {
    const fields: string[] = []
    if (item.description) fields.push(item.description)
    if (item.appearance) fields.push(`外貌: ${item.appearance}`)
    if (item.clothing) fields.push(`服饰: ${item.clothing}`)
    if (item.content) fields.push(`"${item.content.slice(0, 40)}${item.content.length > 40 ? '...' : ''}"`)
    if (item.context) fields.push(`场景: ${item.context}`)
    if (item.with) fields.push(`对话对象: ${item.with}`)
    if (item.status) fields.push(`状态: ${item.status}`)
    if (item.owner) fields.push(`持有者: ${item.owner}`)
    if (item.time) fields.push(`时间: ${item.time}`)
    if (item.location) fields.push(`地点: ${item.location}`)
    if (item.relation) fields.push(`关系: ${item.relation}`)
    if (item.character1 && item.character2) fields.push(`${item.character1} ↔ ${item.character2}${item.relation ? ` (${item.relation})` : ''}`)
    if (item.character && item.item) fields.push(`${item.character} → ${item.item}${item.relation ? ` (${item.relation})` : ''}`)
    if (item.character && item.organization) fields.push(`${item.character} ∈ ${item.organization}${item.relation ? ` (${item.relation})` : ''}`)
    if (item.participants?.length) fields.push(`参与者: ${item.participants.join(', ')}`)
    if (item.type) fields.push(`类型: ${item.type}`)
    if (item.personality) fields.push(`性格: ${item.personality}`)
    return fields
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div
        className="rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>提炼记忆</h2>
          <div className="ml-2">
            <ModelSelector
              providerId={extractProviderId}
              model={extractModel}
              onChange={(pid, m) => { setExtractProviderId(pid); setExtractModel(m); setChatProviderId(pid); setChatModel(m) }}
              disabled={loading}
              minWidth={140}
            />
          </div>
          <div className="relative">
            <button onClick={() => setShowEffortDropdown(!showEffortDropdown)} disabled={loading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <span>{extractEffort === 'low' ? '低' : extractEffort === 'medium' ? '中' : extractEffort === 'high' ? '高' : '最高'}</span>
              <ChevronDown size={10} />
            </button>
            {showEffortDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {(['low', 'medium', 'high', 'max'] as const).map(e => (
                  <button key={e} onClick={() => { setExtractEffort(e); setChatReasoningEffort(e); setShowEffortDropdown(false) }}
                    className="w-full px-3 py-1.5 text-left text-xs"
                    style={{ color: extractEffort === e ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {e === 'low' ? '低' : e === 'medium' ? '中' : e === 'high' ? '高' : '最高(max)'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="icon-btn" style={{ width: 24, height: 24 }} disabled={loading || saving}>
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                正在分析章节内容，提取记忆...
              </span>
            </div>
          )}

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'rgb(185,28,28)' }}>
              {error}
            </div>
          )}

          {!loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
                选择模型后点击开始提取
              </p>
              <button onClick={handleExtract}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Sparkles size={16} />
                开始提取
              </button>
            </div>
          )}

          {!loading && data && sectionKeys.length === 0 && (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
              未从本章内容中识别出可记忆的信息
            </div>
          )}

          {!loading && data && sectionKeys.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                共识别 {sectionKeys.reduce((sum, k) => sum + data[k].length, 0)} 条信息，勾选要保存的：
              </div>

              {sectionKeys.map(key => {
                const items = data[key] as any[]
                const cfg = sectionConfig[key]
                const color = cfg?.color || '#666'
                return (
                  <div key={key} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border-light)' }}>
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                      style={{ backgroundColor: 'var(--color-hover)' }}
                      onClick={() => toggleSection(key)}
                    >
                      <button className="p-0.5" style={{ color: 'var(--color-text-dim)' }}>
                        {collapsed[key] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <span style={{ color }}>{cfg?.icon}</span>
                      <span className="text-xs font-medium flex-1" style={{ color: 'var(--color-text)' }}>
                        {cfg?.label || key}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                        {checked[key]?.size || 0}/{items.length}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); toggleAll(key, items) }}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
                      >
                        {checked[key]?.size === items.length ? '取消全选' : '全选'}
                      </button>
                    </div>

                    {!collapsed[key] && (
                      <div className="divide-y" style={{ borderColor: 'var(--color-border-light)' }}>
                        {items.map((item: any, idx: number) => (
                          <label
                            key={idx}
                            className="flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors"
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <input
                              type="checkbox"
                              checked={checked[key]?.has(idx) || false}
                              onChange={() => toggleItem(key, idx)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                {item.name || item.character || ''}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {renderFields(item).map((f, fi) => (
                                  <span key={fi} className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{f}</span>
                                ))}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!loading && data && sectionKeys.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              已选 {countSelected()} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose()
                  useLayoutStore.getState().openDoc({
                    id: 'memoryGraph:main',
                    type: 'memoryGraph',
                    title: '记忆图谱',
                    entityId: 'memoryGraph',
                    content: '',
                    dirty: false
                  })
                }}
                className="text-xs py-1.5 px-3 rounded flex items-center gap-1"
                style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
              >
                <Eye size={12} />
                在记忆图谱中查看
              </button>
              <button onClick={onClose} className="btn btn-ghost text-xs py-1.5" disabled={saving}>
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || countSelected() === 0}
                className="btn btn-primary text-xs py-1.5 flex items-center gap-1"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} />
                )}
                保存到项目
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
