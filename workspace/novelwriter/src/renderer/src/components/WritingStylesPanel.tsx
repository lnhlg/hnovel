import React, { useState, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/app'

function WritingStylesPanel(): JSX.Element {
  const { writingStyles, loadWritingStyles, saveWritingStyle, deleteWritingStyle } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', instructions: '' })
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    loadWritingStyles()
  }, [])

  const sorted = [...writingStyles].sort((a, b) => a.sortOrder - b.sortOrder)

  const handleAiGenerate = async (): Promise<void> => {
    if (!aiPrompt.trim() || aiLoading) return
    setAiLoading(true)
    try {
      const messages = [
        { role: 'system', content: '你是一位小说写作风格分析专家。根据用户的描述，生成一个写作风格设定。请输出 JSON 格式，包含 name（风格名称）、description（一句话描述）、instructions（详细写作指令，列出3-5条具体指令）。不要输出多余文字，只输出 JSON。' },
        { role: 'user', content: aiPrompt }
      ]
      const result = await window.api.aiChat(messages, { stream: false })
      if (result) {
        const parsed = JSON.parse(result.trim())
        // 修复 AI 输出中可能出现的标点粘连
        const fixPunct = (s: unknown) => typeof s === 'string' ? s.replace(/([。；！？])\s*，/g, '$1') : String(s ?? '')
        setForm({
          name: fixPunct(parsed.name || ''),
          description: fixPunct(parsed.description || ''),
          instructions: fixPunct(parsed.instructions || '')
        })
        setAiPrompt('')
      }
    } catch (err) {
      console.error('AI 生成失败:', err)
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async (id?: string): Promise<void> => {
    if (!form.name.trim()) return
    if (id) {
      await saveWritingStyle({ id, name: form.name, description: form.description, instructions: form.instructions })
    } else {
      await saveWritingStyle({ name: form.name, description: form.description, instructions: form.instructions })
    }
    setEditingId(null)
    setForm({ name: '', description: '', instructions: '' })
  }

  const handleEdit = (style: typeof writingStyles[0]): void => {
    setEditingId(style.id)
    setForm({ name: style.name, description: style.description, instructions: style.instructions })
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这个写作风格吗？')) return
    await deleteWritingStyle(id)
    if (editingId === id) { setEditingId(null); setForm({ name: '', description: '', instructions: '' }) }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          写作风格 ({writingStyles.length})
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {sorted.map(style => (
          <div key={style.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
            {editingId === style.id ? (
              <div className="space-y-2">
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs outline-none"
                  style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  placeholder="风格名称" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs resize-none outline-none" rows={2}
                  style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  placeholder="风格描述（可选）" />
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs resize-none outline-none font-mono" rows={4}
                  style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  placeholder="写作指令：告诉AI如何写作，如语气、句式、描写偏好等" />
                <div className="flex gap-1">
                  <button onClick={() => handleSave(style.id)} className="rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600">保存</button>
                  <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', instructions: '' })}} className="rounded border px-3 py-1 text-xs"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>取消</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{style.name}</span>
                  <div className="hidden group-hover:flex gap-2">
                    <button onClick={() => handleEdit(style)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                    <button onClick={() => handleDelete(style.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                  </div>
                </div>
                {style.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{style.description}</p>}
                {style.instructions && <pre className="mt-1 text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text-dim)' }}>{style.instructions}</pre>}
              </div>
            )}
          </div>
        ))}
        {/* 添加新风格 */}
        {editingId === null && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加写作风格</h4>
            <div className="space-y-1.5">
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs outline-none"
                style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                placeholder="风格名称（如：古风典雅、现代直白）" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs resize-none outline-none" rows={2}
                style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                placeholder="风格描述" />
              <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs resize-none outline-none font-mono" rows={4}
                style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                placeholder="写作指令示例：&#10;1. 使用简洁明快的短句，避免冗长修饰&#10;2. 对话要符合人物身份，市井人物用口语&#10;3. 动作描写要有画面感，多用比喻" />
              <div className="flex gap-1 items-center">
                <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-xs outline-none"
                  style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                  placeholder="描述你想要的写作风格..."
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiGenerate() } }} />
                <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                  className="rounded px-2 py-1 text-xs flex items-center gap-1"
                  style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
                  title="AI 生成">
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI
                </button>
              </div>
              <button onClick={() => handleSave()} disabled={!form.name.trim()}
                className="w-full rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600 disabled:opacity-50">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WritingStylesPanel
