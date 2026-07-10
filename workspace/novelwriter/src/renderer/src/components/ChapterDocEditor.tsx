import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Sparkles, UserPlus, MessageSquare, ChevronDown, X } from 'lucide-react'
import { useLayoutStore, type OpenDoc } from '../store/layout'
import { useAppStore } from '../store/app'
import ExtractCharactersDialog from './dialogs/ExtractCharactersDialog'
import ExtractMemoryDialog from './dialogs/ExtractMemoryDialog'
import AIChatDialog from './dialogs/AIChatDialog'
import AIGenerateDialog from './AIGenerateDialog'
import ModelSelector from './ModelSelector'

interface ChapterDocEditorProps {
  doc: OpenDoc
}

const OUTLINE_HEADER = '## 本章概要'
const CONTENT_HEADER = '## 正文内容'

interface ParsedChapter {
  preamble: string
  outline: string
  content: string
  valid: boolean
}

function parseChapter(raw: string): ParsedChapter {
  if (!raw) return { preamble: '', outline: '', content: '', valid: false }
  const outlineIdx = raw.indexOf(OUTLINE_HEADER)
  const contentIdx = raw.indexOf(CONTENT_HEADER)
  if (outlineIdx === -1 || contentIdx === -1 || contentIdx < outlineIdx) {
    return { preamble: raw, outline: '', content: '', valid: false }
  }
  const preamble = raw.substring(0, outlineIdx)
  let outlineSection = raw.substring(outlineIdx + OUTLINE_HEADER.length, contentIdx)
  let contentSection = raw.substring(contentIdx + CONTENT_HEADER.length)
  // 如果正文区域嵌套了另一份完整文档（旧 bug 产生），提取最里层的正文
  const nestedContentIdx = contentSection.indexOf(CONTENT_HEADER)
  if (nestedContentIdx !== -1) {
    contentSection = contentSection.substring(nestedContentIdx + CONTENT_HEADER.length)
  }
  // 同理，摘掉大纲区域可能混入的内层标记
  const nestedOutlineIdx = outlineSection.indexOf(OUTLINE_HEADER)
  if (nestedOutlineIdx !== -1) {
    outlineSection = outlineSection.substring(0, nestedOutlineIdx)
  }
  const outline = outlineSection.replace(/^\n+/, '').replace(/\s+$/, '')
  const content = contentSection.replace(/^\n+/, '').replace(/\s+$/, '')
  return { preamble, outline, content, valid: true }
}

function buildChapter(preamble: string, outline: string, content: string): string {
  return `${preamble}${OUTLINE_HEADER}\n\n${outline}\n\n${CONTENT_HEADER}\n\n${content}\n`
}

function extractTitle(preamble: string): string {
  const m = preamble.match(/^#\s+(.+)/m)
  return m ? m[1].trim() : ''
}

function replaceTitleInPreamble(preamble: string, newTitle: string): string {
  if (/^#\s+.+/m.test(preamble)) {
    return preamble.replace(/^#\s+.+/m, `# ${newTitle}`)
  }
  return `# ${newTitle}\n\n${preamble}`
}

// 从正文内容开头解析章节标题，如 "第1章 惊变" / "第一章 惊变" / "Chapter 1 惊变"
// 返回完整标题行（含编号前缀），由侧栏显示时统一裁前缀；未匹配返回空串
function extractTitleFromBody(body: string): string {
  if (!body) return ''
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^第\s*[零一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟\d]+\s*[章回节部]\s*[·•.、．：:\s-]*(.+)$/)
    if (m && m[1].trim()) return trimmed
    const m2 = trimmed.match(/^[Cc]hapter\s+\d+[\s-:：]*(.+)$/i)
    if (m2 && m2[1].trim()) return trimmed
    return ''
  }
  return ''
}

export default function ChapterDocEditor({ doc }: ChapterDocEditorProps): JSX.Element {
  const setDocContent = useLayoutStore((s) => s.setDocContent)
  const setDocDirty = useLayoutStore((s) => s.setDocDirty)
  const setDocTitle = useLayoutStore((s) => s.setDocTitle)
  const setDocChapterSubTab = useLayoutStore((s) => s.setDocChapterSubTab)
  const currentProject = useAppStore((s) => s.currentProject)
  const aiGenerate = useAppStore((s) => s.aiGenerate)
  const aiGenerateChapter = useAppStore((s) => s.aiGenerateChapter)
  const loadChapters = useAppStore((s) => s.loadChapters)
  const chapters = useAppStore((s) => s.chapters)
  const chatModel = useAppStore((s) => s.chatModel)
  const chatProviderId = useAppStore((s) => s.chatProviderId)
  const chatReasoningEffort = useAppStore((s) => s.chatReasoningEffort)
  const setChatModel = useAppStore((s) => s.setChatModel)
  const setChatProviderId = useAppStore((s) => s.setChatProviderId)
  const setChatReasoningEffort = useAppStore((s) => s.setChatReasoningEffort)
  const skills = useAppStore((s) => s.skills)
  const characters = useAppStore((s) => s.characters)
  const worldSettings = useAppStore((s) => s.worldSettings)
  const timelines = useAppStore((s) => s.timelines)
  const locations = useAppStore((s) => s.locations)
  const characterRelations = useAppStore((s) => s.characterRelations)
  const saveCharacter = useAppStore((s) => s.saveCharacter)
  const deleteWorldSetting = useAppStore((s) => s.deleteWorldSetting)
  const deleteTimeline = useAppStore((s) => s.deleteTimeline)
  const deleteLocation = useAppStore((s) => s.deleteLocation)
  const deleteCharacterRelation = useAppStore((s) => s.deleteCharacterRelation)
  const loadCharacters = useAppStore((s) => s.loadCharacters)
  const loadWorldSettings = useAppStore((s) => s.loadWorldSettings)
  const loadTimelines = useAppStore((s) => s.loadTimelines)
  const loadLocations = useAppStore((s) => s.loadLocations)
  const loadCharacterRelations = useAppStore((s) => s.loadCharacterRelations)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const [subTab, setSubTab] = useState<'outline' | 'content'>(doc.chapterSubTab || 'outline')
  const [title, setTitle] = useState(doc.title)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showExtract, setShowExtract] = useState(false)
  const [showExtractMemory, setShowExtractMemory] = useState(false)
  const [extractText, setExtractText] = useState('')
  const [showAiChatOutline, setShowAiChatOutline] = useState(false)
  const [genContentDialog, setGenContentDialog] = useState(false)
  const [showAiPolish, setShowAiPolish] = useState(false)
  const [polishInstruction, setPolishInstruction] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState('')
  const [polishResult, setPolishResult] = useState('')
  const [polishCtxBefore, setPolishCtxBefore] = useState('')
  const [polishCtxAfter, setPolishCtxAfter] = useState('')
  const [polishModel, setPolishModel] = useState('')
  const [polishProviderId, setPolishProviderId] = useState('')
  const [polishEffort, setPolishEffort] = useState<'low' | 'medium' | 'high' | 'max'>('medium')
  const [showPolishEffortDropdown, setShowPolishEffortDropdown] = useState(false)
  const [polishHistory, setPolishHistory] = useState<string[]>([])
  const polishUndoStack = useRef<string[]>([])
  const polishRedoStack = useRef<string[]>([])
  const [showPolishHistory, setShowPolishHistory] = useState(false)
  const [deAiMode, setDeAiMode] = useState(false)

  // 加载润色指令历史（滤掉与 skill 内容一致的项）
  useEffect(() => {
    try {
      const raw = localStorage.getItem('novelwriter-polish-history')
      if (raw) {
        const loaded: string[] = JSON.parse(raw)
        const skillContents = new Set(skills.filter(s => s.category?.includes('去AI')).map(s => s.content))
        const filtered = loaded.filter(x => !skillContents.has(x))
        if (filtered.length !== loaded.length) {
          localStorage.setItem('novelwriter-polish-history', JSON.stringify(filtered))
        }
        setPolishHistory(filtered)
      }
    } catch {}
  }, [])

  // 正文编辑器撤销/重做
  const mainUndoStack = useRef<{ text: string; tab: 'outline' | 'content' }[]>([])
  const mainRedoStack = useRef<{ text: string; tab: 'outline' | 'content' }[]>([])
  const undoDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveUndoPoint = useCallback((text: string, tab: 'outline' | 'content'): void => {
    const stack = mainUndoStack.current
    if (stack.length > 0 && stack[stack.length - 1].text === text && stack[stack.length - 1].tab === tab) return
    stack.push({ text, tab })
    if (stack.length > 200) stack.shift()
    mainRedoStack.current = []
  }, [])

  // Refs to hold section text (avoid cursor jump from re-parsing on every keystroke)
  const outlineRef = useRef<string>('')
  const contentRef = useRef<string>('')
  const preambleRef = useRef<string>('')
  const loadedRef = useRef<string>('')
  const titleRef = useRef(title)

  // Initial load: fetch doc content via IPC if empty, then parse into sections
  useEffect(() => {
    if (loadedRef.current === doc.id) return
    loadedRef.current = doc.id

    const init = async (): Promise<void> => {
      let content = doc.content
      if (!content && currentProject) {
        setLoading(true)
        try {
          content = (await window.api.readDoc?.(currentProject.id, doc.type, doc.entityId)) ?? ''
          if (content) {
            setDocContent(doc.id, content)
            setDocDirty(doc.id, false)
          }
        } catch (err) {
          console.error('加载章节内容失败:', err)
        } finally {
          setLoading(false)
        }
      }
      const parsed = parseChapter(content || '')
      preambleRef.current = parsed.preamble
      outlineRef.current = parsed.outline
      contentRef.current = parsed.content
      // 标题优先级：正文开头的章节标题（如"第1章 惊变"）> preamble H1 > doc.title
      const bodyTitle = extractTitleFromBody(parsed.content)
      const t = (bodyTitle || extractTitle(parsed.preamble) || doc.title).trim()
      titleRef.current = t
      setTitle(t)
      // 若正文有章节标题，同步到 preamble H1，保证后续保存时三者一致
      if (bodyTitle) {
        preambleRef.current = replaceTitleInPreamble(preambleRef.current, bodyTitle)
      }
      // 如果解析出的标题与 JSON 不一致，以解析结果为准同步回 JSON 和侧栏
      const ch = useAppStore.getState().chapters.find(c => c.id === doc.entityId)
      if (ch && t && ch.title !== t) {
        ch.title = t
        await window.api.saveChapter({ id: ch.id, projectId: ch.projectId, title: t })
        useAppStore.setState(state => ({
          chapters: state.chapters.map(c => c.id === doc.entityId ? { ...c, title: t } : c)
        }))
      }
      if (textareaRef.current) {
        textareaRef.current.value = subTab === 'outline' ? parsed.outline : parsed.content
        // 初始内容作为第一个撤销点
        saveUndoPoint(textareaRef.current.value, subTab)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  // When sub-tab switches, sync textarea value from ref
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = subTab === 'outline' ? outlineRef.current : contentRef.current
    }
  }, [subTab])

  // Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        // 保存前：若正文开头有章节标题（如"第1章 惊变"），同步到 preamble H1 和标题输入框，
        // 确保 JSON 中 chapter.content 与 MD 文件、侧栏三者标题一致，避免重载后回退
        const bodyTitle = extractTitleFromBody(contentRef.current)
        if (bodyTitle) {
          preambleRef.current = replaceTitleInPreamble(preambleRef.current, bodyTitle)
          titleRef.current = bodyTitle
          setTitle(bodyTitle)
          setDocTitle(doc.id, bodyTitle)
        }
        const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
        setDocContent(doc.id, full)
        window.api.saveChapter({
          id: doc.entityId,
          projectId: currentProject?.id ?? '',
          title: titleRef.current,
          content: full,
          outline: outlineRef.current
        }).then(() => {
          if (currentProject) loadChapters(currentProject.id)
          // 强制更新侧栏（用同步后的标题）
          if (bodyTitle) {
            useAppStore.setState(state => ({
              chapters: state.chapters.map(c => c.id === doc.entityId ? { ...c, title: bodyTitle } : c)
            }))
          }
          setDocDirty(doc.id, false)
        }).catch(console.error)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentProject, doc.entityId, doc.id])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const v = e.target.value
    // 用户输入防抖保存撤销点
    if (undoDebounceTimer.current) clearTimeout(undoDebounceTimer.current)
    undoDebounceTimer.current = setTimeout(() => saveUndoPoint(v, subTab), 800)
    if (subTab === 'outline') {
      outlineRef.current = v
    } else {
      contentRef.current = v
      // 标题优先级：正文开头的章节标题（如"第1章 惊变"）> 正文里的 # H1 标题
      const bodyTitle = extractTitleFromBody(v)
      const titleMatch = v.match(/^#\s+(.+)/m)
      const newTitle = bodyTitle || (titleMatch ? titleMatch[1].trim() : '')
      if (newTitle && newTitle !== titleRef.current) {
        setTitle(newTitle)
        titleRef.current = newTitle
        setDocTitle(doc.id, newTitle)
        preambleRef.current = replaceTitleInPreamble(preambleRef.current, newTitle)
        useAppStore.setState(state => ({
          chapters: state.chapters.map(c => c.id === doc.entityId ? { ...c, title: newTitle } : c)
        }))
      }
    }
    const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
    setDocContent(doc.id, full)
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = e.target.value
    setTitle(v)
    titleRef.current = v
    preambleRef.current = replaceTitleInPreamble(preambleRef.current, v)
    const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
    setDocContent(doc.id, full)
    setDocTitle(doc.id, v)
    // 立即更新侧栏章节标题
    useAppStore.setState(state => ({
      chapters: state.chapters.map(c => c.id === doc.entityId ? { ...c, title: v } : c)
    }))
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const textarea = textareaRef.current
    const selectedText = textarea ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : ''
    // 如果没有选中文字，取当前标签页的全部内容
    const source = selectedText || (subTab === 'outline' ? outlineRef.current : contentRef.current)
    setExtractText(source)
    // 保存选中区域的上下文（前后各500字）
    if (textarea && selectedText) {
      const before = textarea.value.substring(Math.max(0, textarea.selectionStart - 500), textarea.selectionStart)
      const after = textarea.value.substring(textarea.selectionEnd, Math.min(textarea.value.length, textarea.selectionEnd + 500))
      setPolishCtxBefore(before)
      setPolishCtxAfter(after)
    } else {
      setPolishCtxBefore('')
      setPolishCtxAfter('')
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleExtractCharacters = () => {
    setContextMenu(null)
    setShowExtract(true)
  }

  const handleExtractMemory = () => {
    setContextMenu(null)
    setShowExtractMemory(true)
  }

  const handleClearMemory = async () => {
    setContextMenu(null)
    if (!currentProject) return
    const titleMarker = `（${doc.title}）`
    const idMarker = `[ch:${doc.entityId}]`
    if (!confirm(`确定要清除「${doc.title}」提取的所有记忆数据吗？`)) return

    try {
      await loadCharacters(currentProject.id)
      await loadWorldSettings(currentProject.id)
      await loadTimelines(currentProject.id)
      await loadLocations(currentProject.id)
      await loadCharacterRelations(currentProject.id)

      const s = useAppStore.getState()

      const matchesMarker = (str: string) => str.includes(idMarker) || str.includes(titleMarker)
      const extCats = new Set(['物品', '组织', '人物-物品关系', '人物-组织关系', '重要对话'])

      const toUpdateChars = s.characters
        .filter(c => c.importantEvents && matchesMarker(c.importantEvents))
        .map(c => ({ id: c.id, events: c.importantEvents! }))

      const toDeleteWS = s.worldSettings
        .filter(ws => extCats.has(ws.category) && (!ws.description || matchesMarker(ws.description)))

      const toDeleteTL = s.timelines
        .filter(tl => tl.description && matchesMarker(tl.description))

      const toDeleteLoc = s.locations
        .filter(loc => loc.description && matchesMarker(loc.description))

      const toDeleteCR = s.characterRelations
        .filter(cr => cr.description && matchesMarker(cr.description))

      if (toUpdateChars.length + toDeleteWS.length + toDeleteTL.length + toDeleteLoc.length + toDeleteCR.length === 0) {
        if (!confirm(`没有找到标记为「${doc.title}」的记忆数据。\n\n可能原因：这些数据是用旧版本提取的，没有章节标记。\n是否删除所有来自记忆提取的数据（物品/组织/关系记录，共 ${s.worldSettings.filter(ws => extCats.has(ws.category)).length} 条）？\n\n注意：角色、地点、事件、人物关系不会被删除（这些可能有手动创建的数据）。`)) return
        for (const ws of s.worldSettings.filter(ws => extCats.has(ws.category))) {
          await deleteWorldSetting(ws.id)
        }
        for (const c of s.characters.filter(c => c.importantEvents?.trim())) {
          await saveCharacter({ id: c.id, projectId: currentProject.id, importantEvents: '' })
        }
        await loadWorldSettings(currentProject.id)
        await loadCharacters(currentProject.id)
        useLayoutStore.getState().refreshMemoryGraph()
        alert('已清除旧版本提取的记忆数据。建议重新「提炼记忆」以使用新的章节标记功能。')
        return
      }

      for (const c of toUpdateChars) {
        const remaining = c.events.split('\n').filter(line => !matchesMarker(line)).join('\n')
        await saveCharacter({ id: c.id, projectId: currentProject.id, importantEvents: remaining })
      }
      for (const ws of toDeleteWS) await deleteWorldSetting(ws.id)
      for (const tl of toDeleteTL) await deleteTimeline(tl.id)
      for (const loc of toDeleteLoc) await deleteLocation(loc.id)
      for (const cr of toDeleteCR) await deleteCharacterRelation(cr.id)

      await loadCharacters(currentProject.id)
      await loadWorldSettings(currentProject.id)
      await loadTimelines(currentProject.id)
      await loadLocations(currentProject.id)
      await loadCharacterRelations(currentProject.id)
      useLayoutStore.getState().refreshMemoryGraph()

      alert(`已清除 ${toUpdateChars.length + toDeleteWS.length + toDeleteTL.length + toDeleteLoc.length + toDeleteCR.length} 条记忆数据`)
    } catch (err) {
      alert('清除失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  // 右键菜单防溢出：超过视口边界时翻转
  useEffect(() => {
    if (!contextMenu || !menuRef.current) return
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - rect.height - 4}px`
    }
    if (rect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - rect.width - 4}px`
    }
  }, [contextMenu])

  const handleImport = async (target: 'outline' | 'content'): Promise<void> => {
    if (!window.api?.showOpenDialog) return
    if (textareaRef.current) saveUndoPoint(textareaRef.current.value, subTab)
    try {
      const result = await window.api.showOpenDialog({
        title: target === 'outline' ? '导入章节大纲' : '导入章节正文',
        filters: [
          { name: '文本文件', extensions: ['txt', 'md'] }
        ],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths?.length) return
      const filePath = result.filePaths[0]
      const read = await window.api.readTextFile?.(filePath)
      if (!read || read.canceled) return
      const imported = (read.content ?? '').replace(/\r\n/g, '\n').trim()
      if (!imported) {
        alert('文件内容为空')
        return
      }
      // 导入正文时，如果文本首行有 # 标题，自动提取为章节标题
      let contentToUse = imported
      if (target === 'content') {
        const titleMatch = imported.match(/^#\s+(.+)/m)
        if (titleMatch) {
          let newTitle = titleMatch[1].trim()
          newTitle = newTitle.replace(/^第\s*[一二三四五六七八九十百千\d]+\s*章[^a-zA-Z\u4e00-\u9fff]*/i, '')
          newTitle = newTitle.replace(/^Chapter\s+\d+[^a-zA-Z\u4e00-\u9fff]*/i, '')
          newTitle = newTitle.replace(/^\d+[^a-zA-Z\u4e00-\u9fff]*/, '')
          newTitle = newTitle.trim() || titleMatch[1].trim()
          setTitle(newTitle)
          preambleRef.current = replaceTitleInPreamble(preambleRef.current, newTitle)
          setDocTitle(doc.id, newTitle)
          contentToUse = imported
        }
      }
      if (target === 'outline') {
        outlineRef.current = contentToUse
      } else {
        contentRef.current = contentToUse
      }
      const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
      setDocContent(doc.id, full)
      setDocDirty(doc.id, true)
      if (subTab === target && textareaRef.current) {
        textareaRef.current.value = contentToUse
      } else {
        setSubTab(target)
      }
    } catch (err) {
      console.error('导入失败:', err)
      alert('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleGenerateOutline = async (): Promise<void> => {
    const body = contentRef.current.trim()
    if (!body) {
      alert('正文为空，无法生成大纲。请先编写或导入正文。')
      return
    }
    if (!currentProject) return
    if (generatingOutline) return
    if (textareaRef.current) saveUndoPoint(textareaRef.current.value, subTab)
    setGeneratingOutline(true)
    try {
      const result = await aiGenerate({
        type: 'chapter-outline',
        projectId: currentProject.id,
        chapterTitle: title,
        chapterContent: body
      })
      if (result.error) {
        alert('生成失败：' + result.error)
        return
      }
      const data = result.data as { outline?: string } | undefined
      const outline = data?.outline?.trim()
      if (!outline) {
        alert('AI 未返回有效大纲')
        return
      }
      outlineRef.current = outline
      const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
      setDocContent(doc.id, full)
      setDocDirty(doc.id, true)
      setSubTab('outline')
      if (textareaRef.current) {
        textareaRef.current.value = outline
      }
    } catch (err) {
      console.error('生成大纲失败:', err)
      alert('生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setGeneratingOutline(false)
    }
  }

  const handleDeAi = (): void => {
    if (!currentProject) return
    const skillId = currentProject.skillId
    if (!skillId) {
      alert('请先在项目设置中配置「去AI味」技能')
      return
    }
    const skill = skills.find(s => s.id === skillId)
    if (!skill) {
      alert('所选「去AI味」技能不存在，请重新设置')
      return
    }
    // 如果 extractText 为空，从当前 textarea 取值
    if (!extractText.trim()) {
      const ta = textareaRef.current
      if (ta) {
        const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd)
        setExtractText(sel || ta.value)
      }
    }
    setPolishInstruction(skill.content)
    setPolishModel(chatModel || '')
    setPolishProviderId(chatProviderId || '')
    setPolishEffort(chatReasoningEffort)
    setShowAiPolish(true)
    setPolishResult('')
    setPolishError('')
    setDeAiMode(true)
  }

  const handleAiPolish = async (): Promise<void> => {
    if (!polishInstruction.trim() || !extractText.trim() || polishing) return
    setPolishing(true)
    setPolishResult('')
    setPolishError('')
    try {
      const userMsg = polishCtxBefore || polishCtxAfter
        ? `请按照以下要求润色这段文本：\n\n${polishInstruction}\n\n`
          + (polishCtxBefore ? `上文（仅供理解上下文参考，不要润色）：\n${polishCtxBefore}\n\n` : '')
          + `【目标文本（仅润色此段）】\n${extractText}\n\n`
          + (polishCtxAfter ? `下文（仅供理解上下文参考，不要润色）：\n${polishCtxAfter}` : '')
        : `请按照以下要求润色这段文本：\n\n${polishInstruction}\n\n原文：\n${extractText}`
      const messages = [
        { role: 'system', content: '你是一位专业的小说文本润色编辑。请根据用户的要求，仅对标记为【目标文本】的段落进行润色加工。只返回润色后的文本，不要加任何解释或标记。' },
        { role: 'user', content: userMsg }
      ]
      const result = await window.api.aiChat(messages, { stream: false, model: polishModel || undefined, providerId: polishProviderId || undefined, reasoningEffort: polishEffort })
      if (result) {
        setPolishResult(result.trim())
        // 保存指令到历史（跳过与 skill 内容完全一致的，避免去AI味技能的全文反复写入）
        const defaultContent = deAiMode && currentProject?.skillId
          ? skills.find(s => s.id === currentProject.skillId)?.content || ''
          : ''
        if (polishInstruction !== defaultContent) {
          const latest: string[] = JSON.parse(localStorage.getItem('novelwriter-polish-history') || '[]')
          const h = [polishInstruction, ...latest.filter(x => x !== polishInstruction)].slice(0, 10)
          setPolishHistory(h)
          localStorage.setItem('novelwriter-polish-history', JSON.stringify(h))
        }
      }
    } catch (err) {
      // 不使用 alert：alert 是同步阻塞弹窗，会窃取焦点导致 ModelSelector 搜索框无法 refocus
      setPolishError('润色失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPolishing(false)
    }
  }

  const handleApplyPolish = (): void => {
    if (!polishResult || !textareaRef.current) return
    const ta = textareaRef.current
    saveUndoPoint(ta.value, subTab)
    const scrollTop = ta.scrollTop
    const before = ta.value.substring(0, ta.selectionStart)
    const after = ta.value.substring(ta.selectionEnd)
    ta.value = before + polishResult + after
    // 恢复滚动位置和光标
    const newPos = (before + polishResult).length
    ta.selectionStart = ta.selectionEnd = newPos
    ta.scrollTop = scrollTop
    // 同步到 ref
    if (subTab === 'outline') outlineRef.current = ta.value
    else contentRef.current = ta.value
    const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
    setDocContent(doc.id, full)
    setShowAiPolish(false)
    setDeAiMode(false)
    setPolishResult('')
    setPolishInstruction('')
    // 恢复焦点到 textarea
    setTimeout(() => ta.focus(), 0)
  }

  const handleGenerateContent = async (): Promise<void> => {
    if (!currentProject) return

    // 重新加载章节确保获取最新数据
    await loadChapters(currentProject.id)
    const chapter = chapters.find(c => c.id === doc.entityId)
    if (!chapter) return

    // 如果 JSON 中 outline 为空，尝试从 MD 文件读取
    let outline = chapter.outline?.trim()
    if (!outline) {
      try {
        const mdContent = await window.api.readDoc?.(currentProject.id, 'chapter', chapter.id)
        if (mdContent) {
          const match = mdContent.match(/## 本章概要\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/)
          const mdOutline = match?.[1]?.trim()
          if (mdOutline) {
            outline = mdOutline
            // 同步回 JSON
            await window.api.saveChapterOutline(chapter.id, outline)
          }
        }
      } catch { /* ignore read errors */ }
    }

    if (!outline) {
      alert('本章暂无大纲，请先填写或生成大纲。')
      return
    }

    if (textareaRef.current) saveUndoPoint(textareaRef.current.value, subTab)
    const prevChapters = chapters
      .filter((c) => c.sortOrder < chapter.sortOrder && c.id !== chapter.id)
      .map((c) => ({
        title: c.title,
        content: c.content
      }))

    // 流式输出到正文编辑器
    let streamedContent = ''
    const cleanup = window.api.onAiChunk?.((chunk: string) => {
      streamedContent += chunk
      contentRef.current = streamedContent
      if (textareaRef.current && subTab === 'content') {
        textareaRef.current.value = streamedContent
      }
    })

    let content
    try {
      content = await aiGenerateChapter({
        projectId: currentProject.id,
        chapterId: chapter.id,
        synopsis: currentProject.synopsis,
        chapterTitle: chapter.title,
        chapterOutline: outline,
        previousChapters: prevChapters
      })
    } finally {
      cleanup?.()
    }

    if (content) {
      // 用最终完整结果覆盖（确保无遗漏）
      contentRef.current = content
      if (textareaRef.current && subTab === 'content') {
        textareaRef.current.value = content
      }
      await window.api.saveChapter({
        id: chapter.id,
        projectId: currentProject.id,
        title: chapter.title,
        content,
        outline
      })
    }
  }

  if (loading && !doc.content) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
          加载中...
        </p>
      </div>
    )
  }

  const activeText = subTab === 'outline' ? outlineRef.current : contentRef.current
  const wordCount = activeText.replace(/\s/g, '').length

  return (
    <div className="h-full flex flex-col">
      {/* 章节标题 */}
      <div className="px-6 pt-4 pb-2" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className="w-full bg-transparent border-none outline-none text-xl font-bold"
          style={{ color: 'var(--color-text)' }}
          placeholder="章节标题"
        />
      </div>

      {/* 子标签栏：大纲 / 正文 */}
      <div
        className="flex items-center gap-1 px-6 py-2"
        style={{ borderBottom: '1px solid var(--color-border-light)' }}
      >
        <button
          onClick={() => { if (textareaRef.current) saveUndoPoint(textareaRef.current.value, subTab); setSubTab('outline'); setDocChapterSubTab(doc.id, 'outline') }}
          className="px-3 py-1 text-xs rounded transition-colors"
          style={{
            color: subTab === 'outline' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            backgroundColor: subTab === 'outline' ? 'var(--color-accent-light)' : 'transparent',
            fontWeight: subTab === 'outline' ? 600 : 400
          }}
        >
          大纲
        </button>
        <button
          onClick={() => { if (textareaRef.current) saveUndoPoint(textareaRef.current.value, subTab); setSubTab('content'); setDocChapterSubTab(doc.id, 'content') }}
          className="px-3 py-1 text-xs rounded transition-colors"
          style={{
            color: subTab === 'content' ? 'var(--color-accent)' : 'var(--color-text-muted)',
            backgroundColor: subTab === 'content' ? 'var(--color-accent-light)' : 'transparent',
            fontWeight: subTab === 'content' ? 600 : 400
          }}
        >
          正文
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            {wordCount} 字
          </span>
        </div>
      </div>

      {/* 编辑区 */}
      <textarea
        ref={textareaRef}
        defaultValue={activeText}
        onChange={handleTextareaChange}
        onContextMenu={handleContextMenu}
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            const ta = textareaRef.current
            if (!ta || mainUndoStack.current.length === 0) return
            const cur = { text: ta.value, tab: subTab }
            const prev = mainUndoStack.current.pop()!
            mainRedoStack.current.push(cur)
            ta.value = prev.text
            if (prev.tab === 'outline') outlineRef.current = prev.text
            else contentRef.current = prev.text
            const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
            setDocContent(doc.id, full)
          }
          if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault()
            const ta = textareaRef.current
            if (!ta || mainRedoStack.current.length === 0) return
            const cur = { text: ta.value, tab: subTab }
            const next = mainRedoStack.current.pop()!
            mainUndoStack.current.push(cur)
            ta.value = next.text
            if (next.tab === 'outline') outlineRef.current = next.text
            else contentRef.current = next.text
            const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
            setDocContent(doc.id, full)
          }
        }}
        className="flex-1 w-full resize-none border-none bg-transparent text-base leading-relaxed outline-none p-6"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.7'
        }}
        placeholder={
          subTab === 'outline'
            ? '编写本章大纲、情节要点、关键转折...'
            : '编写正文内容...'
        }
        spellCheck={false}
      />

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)'
          }}
        >
          {subTab === 'outline' ? (
            <>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); handleImport('outline') }}
              >
                <Upload size={12} />
                导入大纲
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); setShowAiChatOutline(true) }}
              >
                <MessageSquare size={12} />
                AI 生成大纲
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); handleImport('content') }}
              >
                <Upload size={12} />
                导入正文
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); handleGenerateOutline() }}
                disabled={generatingOutline}
              >
                <Sparkles size={12} />
                {generatingOutline ? '生成中...' : '从正文生成大纲'}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); setGenContentDialog(true) }}
              >
                <Sparkles size={12} />
                AI 生成正文
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => {
                  setContextMenu(null)
                  setShowAiPolish(true)
                  setPolishResult('')
                  setPolishError('')
                  setPolishInstruction('')
                  setPolishModel(chatModel || '')
                  setPolishProviderId(chatProviderId || '')
                  setPolishEffort(chatReasoningEffort)
                }}
              >
                <Sparkles size={12} />
                AI 润色
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => { setContextMenu(null); handleDeAi() }}
              >
                <Sparkles size={12} />
                去AI味
              </button>
            </>
          )}
          <div className="h-px my-1 mx-2" style={{ backgroundColor: 'var(--color-border-light)' }} />
          <button
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={() => { setContextMenu(null); handleExtractMemory() }}
          >
            <Sparkles size={12} />
            提炼记忆
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-danger)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={handleClearMemory}
          >
            <X size={12} />
            清除本章记忆
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors"
            style={{ color: 'var(--color-text)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={() => { setContextMenu(null); handleExtractCharacters() }}
          >
            <UserPlus size={12} />
            从文本中提取角色
          </button>
        </div>
      )}

      {/* 提取角色对话框 */}
      {currentProject && (
        <ExtractCharactersDialog
          open={showExtract}
          onClose={() => setShowExtract(false)}
          sourceText={extractText}
          chapterContents={[]}
          projectId={currentProject.id}
        />
      )}

      {/* 提炼记忆对话框 */}
      {currentProject && (
        <ExtractMemoryDialog
          open={showExtractMemory}
          onClose={() => setShowExtractMemory(false)}
          sourceText={extractText}
          projectId={currentProject.id}
          chapterTitle={title}
          chapterId={doc.entityId}
        />
      )}

      {/* AI 对话写章纲 */}
      {currentProject && (
        <AIChatDialog
          open={showAiChatOutline}
          onClose={() => {
            setShowAiChatOutline(false)
            // 关闭后刷新大纲显示
            const ch = useAppStore.getState().chapters.find(c => c.id === doc.entityId)
            if (ch?.outline && ch.outline !== outlineRef.current) {
              outlineRef.current = ch.outline
              if (textareaRef.current && subTab === 'outline') {
                textareaRef.current.value = ch.outline
              }
            }
          }}
          entityType="chapterOutline"
          projectId={currentProject.id}
          chapterId={doc.entityId}
        />
      )}

      {/* AI 生成正文 */}
      {genContentDialog && (
        <AIGenerateDialog
          title="AI 生成正文"
          chapterTitle={doc.title}
          onClose={() => setGenContentDialog(false)}
          onStart={async () => {
            try {
              await handleGenerateContent()
            } catch (err) {
              throw err
            } finally {
              setGenContentDialog(false)
            }
          }}
        />
      )}

      {/* AI 润色对话框 */}
      {showAiPolish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowAiPolish(false); setDeAiMode(false) }}>
          <div
            className="w-full rounded-xl bg-white p-6 shadow-2xl flex flex-col"
            style={{ backgroundColor: 'var(--color-surface)', width: '96vw', maxWidth: '1800px', height: '94vh' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{deAiMode ? '去AI味' : 'AI 润色'}</h2>
            <p className="mb-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              选中 {extractText.length} 个字符
            </p>

            {/* 错误提示（非阻塞，避免 alert 窃取焦点） */}
            {polishError && (
              <div
                className="mb-3 px-3 py-2 rounded text-xs flex items-start justify-between gap-2"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'rgb(185, 28, 28)'
                }}
              >
                <span className="flex-1 break-all whitespace-pre-wrap">{polishError}</span>
                <button
                  type="button"
                  onClick={() => setPolishError('')}
                  className="text-xs hover:opacity-70 flex-shrink-0"
                  style={{ color: 'rgb(185, 28, 28)' }}
                  title="关闭"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 模型选择器 + 推理力度 */}
            <div className="flex items-center gap-2 mb-3">
              <ModelSelector
                providerId={polishProviderId}
                model={polishModel}
                onChange={(pid, mid) => {
                  setPolishProviderId(pid)
                  setPolishModel(mid)
                  setChatProviderId(pid)
                  setChatModel(mid)
                }}
                disabled={polishing}
                minWidth={160}
              />
              <div className="relative">
                <button onClick={() => setShowPolishEffortDropdown(!showPolishEffortDropdown)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <span>{polishEffort === 'low' ? '低' : polishEffort === 'medium' ? '中' : polishEffort === 'high' ? '高' : '最高'}</span>
                  <ChevronDown size={10} />
                </button>
                {showPolishEffortDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
                    style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    {(['low', 'medium', 'high', 'max'] as const).map(e => (
                      <button key={e} onClick={() => { setPolishEffort(e); setChatReasoningEffort(e); setShowPolishEffortDropdown(false) }}
                        className="w-full px-3 py-1.5 text-left text-xs"
                        style={{ color: polishEffort === e ? 'var(--color-accent)' : 'var(--color-text)' }}>
                        {e === 'low' ? '低' : e === 'medium' ? '中' : e === 'high' ? '高' : '最高(max)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-2 flex flex-col min-h-0" style={{ maxHeight: '50%' }}>
              <label className="mb-1 block text-xs" style={{ color: 'var(--color-text-muted)' }}>原文</label>
              <div className="flex-1 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap min-h-0" style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }}>
                {extractText}
              </div>
            </div>

            {!deAiMode && (
            <div className="mb-3 relative flex-shrink-0">
              <label className="mb-1 block text-xs" style={{ color: 'var(--color-text-muted)' }}>润色指令</label>
              <textarea value={polishInstruction} onChange={e => setPolishInstruction(e.target.value)}
                onFocus={() => polishHistory.length > 0 && setShowPolishHistory(true)}
                onBlur={() => setTimeout(() => setShowPolishHistory(false), 200)}
                className="w-full rounded border px-2 py-1.5 text-xs outline-none resize-none" rows={3}
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                placeholder="如：改得更文雅、增加景物描写、压缩到100字..." />
              {showPolishHistory && polishHistory.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg shadow-lg overflow-hidden"
                  style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {polishHistory.slice(0, 8).map((h, i) => (
                    <div key={i} className="flex items-center group"
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                      <button
                        onMouseDown={e => { e.preventDefault(); setPolishInstruction(h); setShowPolishHistory(false) }}
                        className="flex-1 px-3 py-1.5 text-left text-xs truncate"
                        style={{ color: 'var(--color-text)' }}
                        title={h}>
                        {h}
                      </button>
                      <button
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setPolishHistory(prev => { const next = prev.filter((_, idx) => idx !== i); localStorage.setItem('novelwriter-polish-history', JSON.stringify(next)); return next }) }}
                        className="opacity-0 group-hover:opacity-100 p-1 mr-1 rounded transition-opacity"
                        style={{ color: 'var(--color-text-dim)' }}
                        title="删除">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {polishResult && (
              <div className="mb-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>润色结果</label>
                  <button onClick={handleAiPolish} disabled={polishing}
                    className="text-xs flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                    {polishing ? '重新生成中...' : '🔄 重新生成'}
                  </button>
                </div>
                <textarea value={polishResult}
                  onChange={e => {
                    polishUndoStack.current.push(polishResult)
                    if (polishUndoStack.current.length > 100) polishUndoStack.current.shift()
                    polishRedoStack.current = []
                    setPolishResult(e.target.value)
                  }}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                      e.preventDefault()
                      if (polishUndoStack.current.length > 0) {
                        polishRedoStack.current.push(polishResult)
                        setPolishResult(polishUndoStack.current.pop()!)
                      }
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                      e.preventDefault()
                      if (polishRedoStack.current.length > 0) {
                        polishUndoStack.current.push(polishResult)
                        setPolishResult(polishRedoStack.current.pop()!)
                      }
                    }
                  }}
                  className="flex-1 w-full resize-none rounded border p-2 text-xs whitespace-pre-wrap min-h-0"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-sidebar)' }}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowAiPolish(false); setDeAiMode(false); setPolishResult(''); setPolishInstruction(''); setTimeout(() => textareaRef.current?.focus(), 0) }}
                className="rounded border px-4 py-1.5 text-xs" style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>
                取消
              </button>
              {polishResult ? (
                <button onClick={handleApplyPolish}
                  className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
                  应用并替换原文
                </button>
              ) : (
                <button onClick={handleAiPolish} disabled={polishing || !polishInstruction.trim()}
                  className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: polishing || !polishInstruction.trim() ? 0.5 : 1 }}>
                  {polishing ? '润色中...' : '开始润色'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
