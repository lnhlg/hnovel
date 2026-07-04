import React, { useState, useEffect } from 'react'
import { Sparkles, Loader2, Plus, X } from 'lucide-react'
import { useAppStore } from '../store/app'

function WritingStylesPanel(): JSX.Element {
  const { writingStyles, loadWritingStyles, saveWritingStyle, deleteWritingStyle } = useAppStore()
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', instructions: '' })
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { loadWritingStyles() }, [])

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
        const fixPunct = (s: unknown) => typeof s === 'string' ? s.replace(/([。；！？])\s*，/g, '$1') : String(s ?? '')
        setForm({
          name: fixPunct(parsed.name || ''),
          description: fixPunct(parsed.description || ''),
          instructions: fixPunct(parsed.instructions || '')
        })
        setAiPrompt('')
      }
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally { setAiLoading(false) }
  }

  const handleSave = async (): Promise<void> => {
    if (!form.name.trim()) return
    if (editingId) {
      await saveWritingStyle({ id: editingId, ...form })
    } else {
      await saveWritingStyle(form)
    }
    setShowDialog(false)
    setEditingId(null)
    setForm({ name: '', description: '', instructions: '' })
  }

  const openAdd = (): void => {
    setForm({ name: '', description: '', instructions: '' })
    setEditingId(null)
    setAiPrompt('')
    setShowDialog(true)
  }

  const openEdit = (style: typeof writingStyles[0]): void => {
    setForm({ name: style.name, description: style.description, instructions: style.instructions })
    setEditingId(style.id)
    setAiPrompt('')
    setShowDialog(true)
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这个写作风格吗？')) return
    await deleteWritingStyle(id)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>写作风格 ({writingStyles.length})</span>
        <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
          <Plus size={14} /> 添加
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--color-text-dim)' }}>
            暂无写作风格，点击右上角「添加」创建
          </div>
        )}
        <div className="grid grid-cols-4 gap-3">
          {sorted.map(style => (
            <div key={style.id} className="group rounded-lg p-3" style={{ border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{style.name}</span>
                <div className="hidden group-hover:flex gap-1">
                  <button onClick={() => openEdit(style)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-accent)' }}>编辑</button>
                  <button onClick={() => handleDelete(style.id)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-danger)' }}>删除</button>
                </div>
              </div>
              {style.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{style.description}</p>}
              {style.instructions && <pre className="mt-1 text-xs whitespace-pre-wrap line-clamp-4" style={{ color: 'var(--color-text-dim)' }}>{style.instructions}</pre>}
            </div>
          ))}
        </div>
      </div>

      {/* 添加/编辑对话框 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDialog(false)}>
          <div className="w-[520px] rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{editingId ? '编辑写作风格' : '添加写作风格'}</h2>
              <button onClick={() => setShowDialog(false)} className="icon-btn"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>风格名称</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }}
                  placeholder="如：古风典雅、现代直白" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>描述</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs resize-none outline-none" rows={2}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>写作指令</label>
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs resize-none outline-none font-mono" rows={5}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} />
              </div>
              <div className="flex gap-1 items-center">
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  className="flex-1 rounded border px-3 py-2 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }}
                  placeholder="描述你想要的写作风格..." />
                <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                  className="rounded px-3 py-2 text-xs flex items-center gap-1"
                  style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowDialog(false)} className="rounded border px-4 py-2 text-xs" style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>取消</button>
                <button onClick={handleSave} disabled={!form.name.trim()}
                  className="rounded px-4 py-2 text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: !form.name.trim() ? 0.5 : 1 }}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WritingStylesPanel
