import React, { useState, useEffect } from 'react'
import { Sparkles, Loader2, Plus, X } from 'lucide-react'
import { useAppStore } from '../store/app'

function SkillsPanel(): JSX.Element {
  const { skills, loadSkills, saveSkill, deleteSkill } = useAppStore()
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', content: '' })
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { loadSkills() }, [])

  const sorted = [...skills].sort((a, b) => a.sortOrder - b.sortOrder)

  const handleAiGenerate = async (): Promise<void> => {
    if (!aiPrompt.trim() || aiLoading) return
    setAiLoading(true)
    try {
      const messages = [
        { role: 'system', content: '你是一位小说写作技能专家。根据用户的描述，生成一个写作技能设定。请输出 JSON 格式，包含 name（技能名称）、category（分类）、description（一句话描述）、content（详细技能内容）。不要输出多余文字，只输出 JSON。' },
        { role: 'user', content: aiPrompt }
      ]
      const result = await window.api.aiChat(messages, { stream: false })
      if (result) {
        const fixPunct = (s: unknown) => typeof s === 'string' ? s.replace(/([。；！？])\s*，/g, '$1') : String(s ?? '')
        const parsed = JSON.parse(result.trim())
        setForm({
          name: fixPunct(parsed.name || ''),
          description: fixPunct(parsed.description || ''),
          category: fixPunct(parsed.category || parsed.type || ''),
          content: fixPunct(parsed.content || parsed.instructions || '')
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
      await saveSkill({ id: editingId, ...form })
    } else {
      await saveSkill(form)
    }
    setShowDialog(false)
    setEditingId(null)
    setForm({ name: '', description: '', category: '', content: '' })
  }

  const openAdd = (): void => {
    setForm({ name: '', description: '', category: '', content: '' })
    setEditingId(null)
    setAiPrompt('')
    setShowDialog(true)
  }

  const openEdit = (s: typeof skills[0]): void => {
    setForm({ name: s.name, description: s.description, category: s.category, content: s.content })
    setEditingId(s.id)
    setAiPrompt('')
    setShowDialog(true)
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这个技能吗？')) return
    await deleteSkill(id)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>写作技能 ({skills.length})</span>
        <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}>
          <Plus size={14} /> 添加
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-4 gap-3">
          {sorted.map(s => (
            <div key={s.id} className="rounded-lg p-3" style={{ border: '1px solid var(--color-border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{s.name}</span>
                  {s.category && <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>{s.category}</span>}
                </div>
                <div className="hidden group-hover:flex gap-1">
                  <button onClick={() => openEdit(s)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-accent)' }}>编辑</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-danger)' }}>删除</button>
                </div>
              </div>
              {s.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.description}</p>}
              {s.content && <pre className="mt-1 text-xs whitespace-pre-wrap line-clamp-4" style={{ color: 'var(--color-text-dim)' }}>{s.content}</pre>}
            </div>
          ))}
        </div>
      </div>
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowDialog(false)}>
          <div className="w-[520px] rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>{editingId ? '编辑写作技能' : '添加写作技能'}</h2>
              <button onClick={() => setShowDialog(false)}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>技能名称</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>分类</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>描述</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs resize-none outline-none" rows={2}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} /></div>
              <div><label className="text-xs mb-1 block" style={{ color: 'var(--color-text-muted)' }}>内容</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-xs resize-none outline-none font-mono" rows={5}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }} /></div>
              <div className="flex gap-1">
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  className="flex-1 rounded border px-3 py-2 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-sidebar)' }}
                  placeholder="描述你想要的写作技能..." />
                <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()}
                  className="rounded px-3 py-2 text-xs flex items-center gap-1"
                  style={{ color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
                  {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI</button>
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
export default SkillsPanel
