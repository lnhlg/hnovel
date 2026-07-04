import React, { useEffect, useRef, useState } from 'react'
import { Upload, Sparkles, UserPlus, MessageSquare, ChevronDown } from 'lucide-react'
import { useLayoutStore, type OpenDoc } from '../store/layout'
import { useAppStore } from '../store/app'
import ExtractCharactersDialog from './dialogs/ExtractCharactersDialog'
import AIChatDialog from './dialogs/AIChatDialog'
import AIGenerateDialog from './AIGenerateDialog'

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

export default function ChapterDocEditor({ doc }: ChapterDocEditorProps): JSX.Element {
  const setDocContent = useLayoutStore((s) => s.setDocContent)
  const setDocDirty = useLayoutStore((s) => s.setDocDirty)
  const setDocTitle = useLayoutStore((s) => s.setDocTitle)
  const currentProject = useAppStore((s) => s.currentProject)
  const aiGenerate = useAppStore((s) => s.aiGenerate)
  const aiGenerateChapter = useAppStore((s) => s.aiGenerateChapter)
  const loadChapters = useAppStore((s) => s.loadChapters)
  const chapters = useAppStore((s) => s.chapters)
  const chatModel = useAppStore((s) => s.chatModel)
  const chatReasoningEffort = useAppStore((s) => s.chatReasoningEffort)
  const setChatModel = useAppStore((s) => s.setChatModel)
  const setChatReasoningEffort = useAppStore((s) => s.setChatReasoningEffort)
  const skills = useAppStore((s) => s.skills)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [loading, setLoading] = useState(false)
  const [generatingOutline, setGeneratingOutline] = useState(false)
  const [subTab, setSubTab] = useState<'outline' | 'content'>('outline')
  const [title, setTitle] = useState(doc.title)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showExtract, setShowExtract] = useState(false)
  const [extractText, setExtractText] = useState('')
  const [showAiChatOutline, setShowAiChatOutline] = useState(false)
  const [genContentDialog, setGenContentDialog] = useState(false)
  const [showAiPolish, setShowAiPolish] = useState(false)
  const [polishInstruction, setPolishInstruction] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [polishResult, setPolishResult] = useState('')
  const [polishCtxBefore, setPolishCtxBefore] = useState('')
  const [polishCtxAfter, setPolishCtxAfter] = useState('')
  const [polishModels, setPolishModels] = useState<{ id: string; name: string }[]>([])
  const [polishModel, setPolishModel] = useState('')
  const [polishEffort, setPolishEffort] = useState<'low' | 'medium' | 'high' | 'max'>('medium')
  const [showPolishModelDropdown, setShowPolishModelDropdown] = useState(false)
  const [showPolishEffortDropdown, setShowPolishEffortDropdown] = useState(false)
  const [polishHistory, setPolishHistory] = useState<string[]>([])
  const [showPolishHistory, setShowPolishHistory] = useState(false)
  const [deAiMode, setDeAiMode] = useState(false)

  // 加载润色指令历史
  useEffect(() => {
    try {
      const raw = localStorage.getItem('novelwriter-polish-history')
      if (raw) setPolishHistory(JSON.parse(raw))
    } catch {}
  }, [])

  // Refs to hold section text (avoid cursor jump from re-parsing on every keystroke)
  const outlineRef = useRef<string>('')
  const contentRef = useRef<string>('')
  const preambleRef = useRef<string>('')
  const loadedRef = useRef<string>('')

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
      const t = (extractTitle(parsed.preamble) || doc.title).replace(/^(?:\d+\.[\s-]*|第\s*[一二三四五六七八九十百千\d]+\s*章\s*[·•.、．:\s-]*)+/, '').trim()
      setTitle(t)
      // 如果 MD 标题与 JSON 不一致，以 MD 为准同步回 JSON 和侧栏
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
        const full = buildChapter(preambleRef.current, outlineRef.current, contentRef.current)
        setDocContent(doc.id, full)
        window.api.saveChapter({
          id: doc.entityId,
          projectId: currentProject?.id ?? '',
          title,
          content: contentRef.current,
          outline: outlineRef.current
        }).then(() => {
          if (currentProject) loadChapters(currentProject.id)
          setDocDirty(doc.id, false)
        }).catch(console.error)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [title, currentProject, doc.entityId, doc.id])

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const v = e.target.value
    if (subTab === 'outline') {
      outlineRef.current = v
    } else {
      contentRef.current = v
      // 从正文中提取标题同步到侧栏
      const titleMatch = v.match(/^#\s+(.+)/m)
      if (titleMatch) {
        const newTitle = titleMatch[1].trim()
        setTitle(newTitle)
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

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  const handleImport = async (target: 'outline' | 'content'): Promise<void> => {
    if (!window.api?.showOpenDialog) return
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
    setPolishEffort(chatReasoningEffort)
    window.api.listModels?.().then((list: { id: string; name: string }[]) => {
      if (list?.[0]) setPolishModels(list)
    }).catch(() => {})
    setShowAiPolish(true)
    setPolishResult('')
    setDeAiMode(true)
  }

  const handleAiPolish = async (): Promise<void> => {
    if (!polishInstruction.trim() || !extractText.trim() || polishing) return
    setPolishing(true)
    setPolishResult('')
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
      const result = await window.api.aiChat(messages, { stream: false, model: polishModel || undefined, reasoningEffort: polishEffort })
      if (result) {
        setPolishResult(result.trim())
        // 保存指令到历史
        const h = [polishInstruction, ...polishHistory.filter(x => x !== polishInstruction)].slice(0, 10)
        setPolishHistory(h)
        localStorage.setItem('novelwriter-polish-history', JSON.stringify(h))
      }
    } catch (err) {
      alert('润色失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setPolishing(false)
    }
  }

  const handleApplyPolish = (): void => {
    if (!polishResult || !textareaRef.current) return
    const ta = textareaRef.current
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
          onClick={() => setSubTab('outline')}
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
          onClick={() => setSubTab('content')}
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
                  setPolishInstruction('')
                  setPolishModel(chatModel || '')
                  setPolishEffort(chatReasoningEffort)
                  window.api.listModels?.().then((list: { id: string; name: string }[]) => {
                    if (list?.[0]) setPolishModels(list)
                  }).catch(() => {})
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
          projectId={currentProject.id}
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
          <div className="w-full max-w-4xl max-h-[95vh] mx-8 rounded-xl bg-white p-6 shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>{deAiMode ? '去AI味' : 'AI 润色'}</h2>
            <p className="mb-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              选中 {extractText.length} 个字符
            </p>

            {/* 模型选择器 + 推理力度 */}
            <div className="flex items-center gap-2 mb-3">
              {polishModels.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowPolishModelDropdown(!showPolishModelDropdown)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', minWidth: 120 }}>
                    <span className="truncate">{polishModel || '选择模型'}</span>
                    <ChevronDown size={10} />
                  </button>
                  {showPolishModelDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[160px]"
                      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                      {polishModels.map(m => (
                        <button key={m.id} onClick={() => { setPolishModel(m.id); setChatModel(m.id); setShowPolishModelDropdown(false) }}
                          className="w-full px-3 py-1.5 text-left text-xs"
                          style={{ color: polishModel === m.id ? 'var(--color-accent)' : 'var(--color-text)' }}>
                          {m.name || m.id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

            <div className="mb-2">
              <label className="mb-1 block text-xs" style={{ color: 'var(--color-text-muted)' }}>原文</label>
              <div className="max-h-56 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }}>
                {extractText}
              </div>
            </div>

            {!deAiMode && (
            <div className="mb-3 relative">
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
                    <button key={i}
                      onMouseDown={e => { e.preventDefault(); setPolishInstruction(h); setShowPolishHistory(false) }}
                      className="w-full px-3 py-1.5 text-left text-xs truncate"
                      style={{ color: 'var(--color-text)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      title={h}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}

            {polishResult && (
              <div className="mb-3 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>润色结果</label>
                  <button onClick={handleAiPolish} disabled={polishing}
                    className="text-xs flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                    {polishing ? '重新生成中...' : '🔄 重新生成'}
                  </button>
                </div>
                <div className="max-h-48 overflow-auto rounded border p-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text)', borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-sidebar)' }}>
                  {polishResult}
                </div>
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
