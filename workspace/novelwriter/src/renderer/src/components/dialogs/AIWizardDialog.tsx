import React, { useState, useEffect, useRef } from 'react'
import { X, Send, Sparkles, FolderOpen, Check, Loader2, ChevronDown, RefreshCw, Edit3 } from 'lucide-react'

interface WizardMessage {
  role: 'user' | 'assistant'
  content: string
}

interface WizardProjectData {
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

interface AIModel {
  id: string
  name: string
}

interface AIWizardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (projectId: string) => void
}

function generateSessionId(): string {
  return 'wizard_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
}

export default function AIWizardDialog({ open, onClose, onCreated }: AIWizardDialogProps): JSX.Element | null {
  const [messages, setMessages] = useState<WizardMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasProjectData, setHasProjectData] = useState(false)
  const [projectData, setProjectData] = useState<WizardProjectData | null>(null)
  const [folderPath, setFolderPath] = useState('')
  const [pickingFolder, setPickingFolder] = useState(false)
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [step, setStep] = useState<'selectFolder' | 'chat'>('selectFolder') // 新增步骤状态
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const sessionIdRef = useRef<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamContentRef = useRef('')

  useEffect(() => {
    if (open) {
      const sid = generateSessionId()
      sessionIdRef.current = sid
      setMessages([])
      setInput('')
      setIsLoading(false)
      setHasProjectData(false)
      setProjectData(null)
      setFolderPath('')
      setCreating(false)
      setErrorMsg('')
      setStep('selectFolder') // 重置到选择文件夹步骤
      setEditingIndex(null)
      setEditingContent('')
      setSelectedOptions([])
      streamContentRef.current = ''

      const loadModels = async () => {
        setIsLoadingModels(true)
        try {
          const modelList = await window.api.listModels?.()
          if (modelList && Array.isArray(modelList)) {
            setModels(modelList)
            if (modelList.length > 0 && !selectedModel) {
              setSelectedModel(modelList[0].id)
            }
          }
        } catch (err) {
          console.error('加载模型列表失败:', err)
        } finally {
          setIsLoadingModels(false)
        }
      }

      loadModels()
    } else {
      if (sessionIdRef.current) {
        window.api.wizardEnd?.(sessionIdRef.current).catch(() => {})
      }
    }
  }, [open])

  // 当用户选择了文件夹并进入聊天步骤时，初始化AI会话
  const startChat = async (): Promise<void> => {
    if (!folderPath.trim()) return

    setStep('chat')
    setIsLoading(true)
    setErrorMsg('')
    streamContentRef.current = ''

    try {
      // 先初始化会话
      await window.api.wizardInit?.(sessionIdRef.current)

      const cleanup = window.api.onWizardChunk?.((_sessId: string, chunk: string) => {
        streamContentRef.current += chunk
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && prev.length > 0) {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: streamContentRef.current }
            return updated
          }
          return prev
        })
      })

      setMessages([{ role: 'assistant', content: '' }])

      try {
        const result = await window.api.wizardSend?.(sessionIdRef.current, '你好，我想创建一个小说项目', selectedModel)
        if (result) {
          streamContentRef.current = result.content
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant') {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, content: result.content }
              return updated
            }
            return [...prev, { role: 'assistant', content: result.content }]
          })
          setHasProjectData(result.hasProjectData)
          if (result.projectData) {
            setProjectData(result.projectData)
          }
        }
      } finally {
        cleanup?.()
      }
    } catch (err) {
      console.error('向导初始化失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 解析消息中的选项
  const parseOptions = (content: string): { text: string; options: string[] } => {
    const optionRegex = /\[\[OPTION:(.+?)\]\]/g
    const options: string[] = []
    let match
    while ((match = optionRegex.exec(content)) !== null) {
      options.push(match[1].trim())
    }
    const text = content.replace(/\[\[OPTION:.+?\]\]/g, '').trim()
    return { text, options }
  }

  // 当最后一条 assistant 消息的选项变化时，清除多选状态
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        const { options } = parseOptions(messages[i].content)
        if (options.length > 0) {
          setSelectedOptions((prev) => prev.filter((o) => options.includes(o)))
        }
        break
      }
    }
  }, [messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 切换选项的多选状态
  const handleOptionToggle = (option: string): void => {
    if (isLoading) return
    setSelectedOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    )
  }

  // 发送所有选中的选项（合并为一条消息）
  const handleSendOptions = async (): Promise<void> => {
    if (selectedOptions.length === 0 || isLoading) return

    const userMsg = selectedOptions.join('，')
    setInput('')
    setSelectedOptions([])
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)
    streamContentRef.current = ''
    setErrorMsg('')

    const cleanup = window.api.onWizardChunk?.((sessId: string, chunk: string) => {
      if (sessId !== sessionIdRef.current) return
      streamContentRef.current += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: streamContentRef.current }
          return updated
        }
        return [...prev, { role: 'assistant', content: streamContentRef.current }]
      })
    })

    try {
      const result = await window.api.wizardSend?.(sessionIdRef.current, userMsg, selectedModel)
      if (result) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: result.content }
            return updated
          }
          return [...prev, { role: 'assistant', content: result.content }]
        })
        setHasProjectData(result.hasProjectData)
        if (result.projectData) {
          setProjectData(result.projectData)
        }
      }
    } catch (err) {
      console.error('发送选项失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '发送失败')
    } finally {
      setIsLoading(false)
      cleanup?.()
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || isLoading) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)
    streamContentRef.current = ''
    setErrorMsg('')

    const cleanup = window.api.onWizardChunk?.((sessId: string, chunk: string) => {
      if (sessId !== sessionIdRef.current) return
      streamContentRef.current += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: streamContentRef.current }
          return updated
        }
        return [...prev, { role: 'assistant', content: streamContentRef.current }]
      })
    })

    try {
      const result = await window.api.wizardSend?.(sessionIdRef.current, userMsg, selectedModel)
      if (result) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: result.content }
            return updated
          }
          return [...prev, { role: 'assistant', content: result.content }]
        })
        setHasProjectData(result.hasProjectData)
        if (result.projectData) {
          setProjectData(result.projectData)
        }
      }
    } catch (err) {
      console.error('发送消息失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '发送失败')
    } finally {
      setIsLoading(false)
      cleanup?.()
    }
  }

  const handleRegenerate = async (): Promise<void> => {
    if (isLoading || creating) return

    setIsLoading(true)
    setErrorMsg('')
    streamContentRef.current = ''

    // 移除最后一条 assistant 消息，重新生成
    setMessages((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      if (last.role === 'assistant') {
        return [...prev.slice(0, -1), { role: 'assistant', content: '' }]
      }
      return prev
    })

    const cleanup = window.api.onWizardChunk?.((sessId: string, chunk: string) => {
      if (sessId !== sessionIdRef.current) return
      streamContentRef.current += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: streamContentRef.current }
          return updated
        }
        return prev
      })
    })

    try {
      const result = await window.api.wizardRegenerate?.(sessionIdRef.current, selectedModel)
      if (result) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: result.content }
            return updated
          }
          return [...prev, { role: 'assistant', content: result.content }]
        })
        setHasProjectData(result.hasProjectData)
        if (result.projectData) {
          setProjectData(result.projectData)
        } else {
          setProjectData(null)
          setHasProjectData(false)
        }
      }
    } catch (err) {
      console.error('重新生成失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '重新生成失败')
    } finally {
      setIsLoading(false)
      cleanup?.()
    }
  }

  const handleStartEdit = (index: number): void => {
    if (isLoading || creating) return
    const msg = messages[index]
    if (msg.role !== 'user') return
    setEditingIndex(index)
    setEditingContent(msg.content)
  }

  const handleCancelEdit = (): void => {
    setEditingIndex(null)
    setEditingContent('')
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (editingIndex === null || !editingContent.trim() || isLoading || creating) return

    const updatedMessages = [...messages]
    updatedMessages[editingIndex] = { ...updatedMessages[editingIndex], content: editingContent.trim() }
    setMessages(updatedMessages)
    setEditingIndex(null)
    setEditingContent('')

    try {
      await window.api.wizardSend?.(sessionIdRef.current, editingContent.trim(), selectedModel)
    } catch (err) {
      console.error('编辑后重新发送失败:', err)
    }
  }

  // 生成项目规范：发送触发词让 AI 输出完整 JSON
  const handleGenerateSpec = async (): Promise<void> => {
    if (isLoading || creating || messages.length === 0) return

    const triggerMsg = '生成项目规范'
    setMessages((prev) => [...prev, { role: 'user', content: triggerMsg }])
    setIsLoading(true)
    streamContentRef.current = ''
    setErrorMsg('')

    const cleanup = window.api.onWizardChunk?.((sessId: string, chunk: string) => {
      if (sessId !== sessionIdRef.current) return
      streamContentRef.current += chunk
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant') {
          const updated = [...prev]
          updated[updated.length - 1] = { ...last, content: streamContentRef.current }
          return updated
        }
        return [...prev, { role: 'assistant', content: streamContentRef.current }]
      })
    })

    try {
      const result = await window.api.wizardSend?.(sessionIdRef.current, triggerMsg, selectedModel)
      if (result) {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant') {
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, content: result.content }
            return updated
          }
          return [...prev, { role: 'assistant', content: result.content }]
        })
        setHasProjectData(result.hasProjectData)
        if (result.projectData) {
          setProjectData(result.projectData)
        } else {
          // AI 没有返回 JSON，提示用户
          setErrorMsg('AI 未生成项目数据，请继续对话补充信息后再试')
        }
      }
    } catch (err) {
      console.error('生成项目规范失败:', err)
      setErrorMsg(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsLoading(false)
      cleanup?.()
    }
  }

  const handlePickFolder = async (): Promise<void> => {
    setPickingFolder(true)
    try {
      const result = await window.api.selectFolder()
      if (!result.canceled && result.filePaths.length > 0) {
        setFolderPath(result.filePaths[0])
      }
    } catch (err) {
      console.error('选择文件夹失败:', err)
    } finally {
      setPickingFolder(false)
    }
  }

  const handleCreateProject = async (): Promise<void> => {
    if (!projectData || !folderPath.trim() || creating) return

    console.log('[handleCreateProject] 开始创建, sessionId:', sessionIdRef.current, 'folderPath:', folderPath)
    setCreating(true)
    setErrorMsg('')

    try {
      const result = await window.api.wizardCreateProject?.(sessionIdRef.current, folderPath)
      console.log('[handleCreateProject] 创建结果:', result)
      if (result && result.success && result.project) {
        onCreated(result.project.id)
        onClose()
      } else {
        console.error('[handleCreateProject] 创建失败，返回:', result)
        setErrorMsg('创建项目失败：返回数据异常')
      }
    } catch (err) {
      console.error('[handleCreateProject] 创建项目异常:', err)
      setErrorMsg(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && !isLoading && !creating) {
      onClose()
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading && !creating) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-[720px] h-[600px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              AI 智能创建项目
            </h2>
          </div>
          
          {/* 模型选择器 */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                disabled={isLoading || creating}
                className="btn btn-ghost flex items-center gap-1.5 text-xs"
                style={{ minWidth: 140 }}
              >
                {isLoadingModels ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <>
                    {selectedModel || '选择模型'}
                    <ChevronDown size={12} />
                  </>
                )}
              </button>
              {showModelDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden min-w-[180px]"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {models.length > 0 ? (
                    <div className="py-1">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id)
                            setShowModelDropdown(false)
                          }}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-accent-light"
                          style={{
                            color: model.id === selectedModel ? 'var(--color-accent)' : 'var(--color-text)',
                            backgroundColor: model.id === selectedModel ? 'var(--color-accent-light)' : 'transparent'
                          }}
                        >
                          {model.name || model.id}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-xs text-text-secondary">
                      暂无可用模型
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={onClose}
              disabled={isLoading || creating}
              className="icon-btn"
              style={{ width: 24, height: 24 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 第一步：选择文件夹 */}
        {step === 'selectFolder' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div
              className="w-full max-w-md rounded-xl p-6 text-center"
              style={{
                backgroundColor: 'var(--color-sidebar)',
                border: '1px solid var(--color-border)'
              }}
            >
              <FolderOpen size={48} style={{ color: 'var(--color-accent)' }} className="mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                选择项目保存位置
              </h3>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                在开始创建之前，请先选择一个文件夹来存放你的小说项目
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="选择一个文件夹..."
                  className="input flex-1 text-xs"
                  disabled={pickingFolder}
                  readOnly
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={pickingFolder}
                  className="btn btn-ghost"
                  style={{ flexShrink: 0 }}
                >
                  <FolderOpen size={14} />
                  <span>{pickingFolder ? '选择中...' : '浏览'}</span>
                </button>
              </div>

              {errorMsg && (
                <div
                  className="rounded-lg px-3 py-2 text-xs mb-4"
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    color: 'var(--color-danger)'
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={startChat}
                disabled={!folderPath.trim() || isLoadingModels || pickingFolder}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                <span>开始智能创建</span>
              </button>
            </div>
          </div>
        )}

        {/* 第二步：聊天创建 */}
        {step === 'chat' && (
          <>
            {/* 项目预览（当有项目数据时显示） */}
            {hasProjectData && projectData && (
              <div
                className="px-4 py-3"
                style={{
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-sidebar)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                    📋 项目规划已就绪
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--color-accent-light)',
                      color: 'var(--color-accent)'
                    }}
                  >
                    {projectData.chapters?.length || 0} 章 · {projectData.characters?.length || 0} 角色 · {projectData.worldSettings?.length || 0} 设定
                  </span>
                </div>
                <div className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                  <p><strong>项目名：</strong>{projectData.name}</p>
                  <p><strong>题材：</strong>{projectData.genre}</p>
                  {projectData.worldBackground && (
                    <p><strong>世界观：</strong>{projectData.worldBackground.slice(0, 100)}{projectData.worldBackground.length > 100 ? '...' : ''}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {projectData.timelines && projectData.timelines.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface)' }}>⏰ {projectData.timelines.length} 时间节点</span>
                    )}
                    {projectData.locations && projectData.locations.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface)' }}>📍 {projectData.locations.length} 地点</span>
                    )}
                    {projectData.characterRelations && projectData.characterRelations.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface)' }}>🔗 {projectData.characterRelations.length} 关系</span>
                    )}
                    {projectData.inspirations && projectData.inspirations.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-surface)' }}>💡 {projectData.inspirations.length} 灵感</span>
                    )}
                  </div>
                </div>

                {/* 保存位置提示 */}
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <FolderOpen size={12} />
                  <span>规范文件将保存至：{folderPath}/{projectData.name}</span>
                </div>

                {/* 生成按钮 */}
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCreateProject}
                    disabled={creating}
                    className="btn btn-primary flex items-center gap-1.5"
                  >
                    {creating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>生成规范文件中...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>确认并生成项目规范</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 消息区域 */}
            <div
              className="flex-1 overflow-auto p-4 space-y-4"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
              {messages.map((msg, i) => {
                const { text, options } = msg.role === 'assistant' ? parseOptions(msg.content) : { text: msg.content, options: [] }
                const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
                const isEditing = editingIndex === i
                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === 'user'
                          ? 'var(--color-accent)'
                          : 'var(--color-sidebar)',
                        color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                        border: msg.role === 'assistant' ? '1px solid var(--color-border-light)' : 'none',
                      }}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full resize-none rounded-lg px-3 py-2 text-sm"
                            style={{
                              backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.15)' : 'var(--color-surface)',
                              color: msg.role === 'user' ? 'white' : 'var(--color-text)',
                              border: '1px solid var(--color-accent)',
                              outline: 'none',
                              fontFamily: 'inherit'
                            }}
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1 text-xs rounded-md transition-colors"
                              style={{
                                backgroundColor: 'transparent',
                                color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = msg.role === 'user' ? 'rgba(255,255,255,0.1)' : 'var(--color-accent-light)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={!editingContent.trim()}
                              className="px-3 py-1 text-xs rounded-md transition-colors"
                              style={{
                                backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--color-accent)',
                                color: 'white',
                                opacity: editingContent.trim() ? 1 : 0.5,
                                cursor: editingContent.trim() ? 'pointer' : 'not-allowed',
                              }}
                              onMouseEnter={(e) => {
                                if (editingContent.trim()) {
                                  e.currentTarget.style.backgroundColor = msg.role === 'user' ? 'rgba(255,255,255,0.3)' : 'var(--color-accent)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (editingContent.trim()) {
                                  e.currentTarget.style.backgroundColor = msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--color-accent)'
                                }
                              }}
                            >
                              保存并重新发送
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <pre
                            className="whitespace-pre-wrap m-0"
                            style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
                          >
                            {text || (isLoading && isLastAssistant ? '思考中...' : '')}
                          </pre>
                          {options.length > 0 && msg.role === 'assistant' && (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt, optIdx) => {
                                  const isSelected = selectedOptions.includes(opt)
                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      onClick={() => handleOptionToggle(opt)}
                                      disabled={isLoading}
                                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
                                      style={{
                                        backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-accent-light)',
                                        color: isSelected ? 'white' : 'var(--color-accent)',
                                        border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-accent)',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        opacity: isLoading ? 0.5 : 1,
                                      }}
                                    >
                                      {isSelected ? '✓ ' : ''}{opt}
                                    </button>
                                  )
                                })}
                              </div>
                              {selectedOptions.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleSendOptions}
                                  disabled={isLoading}
                                  className="mt-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    opacity: isLoading ? 0.5 : 1,
                                  }}
                                >
                                  发送选择（{selectedOptions.length}项）
                                </button>
                              )}
                            </div>
                          )}
                          {/* 用户消息显示编辑按钮 */}
                          {msg.role === 'user' && !isLoading && !creating && (
                            <div className="mt-2 pt-2 flex justify-end" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(i)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                                style={{
                                  color: 'rgba(255,255,255,0.7)',
                                  backgroundColor: 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                                  e.currentTarget.style.color = 'white'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                  e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                                }}
                              >
                                <Edit3 size={12} />
                                <span>编辑</span>
                              </button>
                            </div>
                          )}
                          {/* 最后一条AI消息且不在加载时显示刷新按钮 */}
                          {isLastAssistant && !isLoading && !creating && msg.content && (
                            <div className="mt-2 pt-2 flex justify-end" style={{ borderTop: options.length > 0 ? 'none' : '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={handleRegenerate}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                                style={{
                                  color: 'var(--color-text-secondary)',
                                  backgroundColor: 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--color-accent-light)'
                                  e.currentTarget.style.color = 'var(--color-accent)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                                }}
                              >
                                <RefreshCw size={12} />
                                <span>重新生成</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {errorMsg && (
                <div className="flex justify-center">
                  <div
                    className="rounded-lg px-4 py-2 text-xs"
                    style={{
                      backgroundColor: 'rgba(239,68,68,0.1)',
                      color: 'var(--color-danger)'
                    }}
                  >
                    {errorMsg}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div
              className="p-3"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={isLoading ? 'AI 正在输出中...' : '输入你的想法...（Enter 发送，Shift+Enter 换行）'}
                  className="textarea flex-1 resize-none text-sm"
                  rows={2}
                  disabled={isLoading || creating}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || creating}
                  className="btn btn-primary flex items-center gap-1.5 h-9"
                  style={{ minWidth: 80 }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>生成中</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>发送</span>
                    </>
                  )}
                </button>
                {/* 生成项目规范按钮 */}
                <button
                  onClick={handleGenerateSpec}
                  disabled={isLoading || creating || messages.length === 0}
                  className="btn flex items-center gap-1.5 h-9"
                  style={{
                    minWidth: 120,
                    backgroundColor: 'var(--color-accent)',
                    color: 'white',
                    opacity: (isLoading || creating || messages.length === 0) ? 0.5 : 1
                  }}
                >
                  <Sparkles size={14} />
                  <span>生成项目规范</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
