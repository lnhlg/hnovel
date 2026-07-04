import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'

function SkillsPanel(): JSX.Element {
  const { skills, loadSkills, saveSkill, deleteSkill } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', content: '' })

  useEffect(() => { loadSkills() }, [])

  const sorted = [...skills].sort((a, b) => a.sortOrder - b.sortOrder)

  const handleSave = async (id?: string): Promise<void> => {
    if (!form.name.trim()) return
    await saveSkill(id
      ? { id, ...form }
      : { ...form })
    setEditingId(null)
    setForm({ name: '', description: '', category: '', content: '' })
  }

  const handleEdit = (s: typeof skills[0]): void => {
    setEditingId(s.id)
    setForm({ name: s.name, description: s.description, category: s.category, content: s.content })
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这个技能吗？')) return
    await deleteSkill(id)
    if (editingId === id) { setEditingId(null); setForm({ name: '', description: '', category: '', content: '' }) }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          写作技能 ({skills.length})
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {sorted.map(s => (
          <div key={s.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
            {editingId === s.id ? (
              <div className="space-y-2">
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="技能名称" />
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs outline-none"
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="分类（如：描写、对话、叙事）" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs resize-none outline-none" rows={2}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="技能描述" />
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs resize-none outline-none font-mono" rows={5}
                  style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                  placeholder="技能内容：具体写作技巧说明，如何应用到小说写作中" />
                <div className="flex gap-1">
                  <button onClick={() => handleSave(s.id)} className="rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600">保存</button>
                  <button onClick={() => { setEditingId(null); setForm({ name: '', description: '', category: '', content: '' }) }}
                    className="rounded border px-3 py-1 text-xs"
                    style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)' }}>取消</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{s.name}</span>
                  <div className="hidden group-hover:flex gap-2">
                    <button onClick={() => handleEdit(s)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                  </div>
                </div>
                {s.category && <span className="text-xs" style={{ color: 'var(--color-accent)' }}>{s.category}</span>}
                {s.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.description}</p>}
                {s.content && <pre className="mt-1 text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text-dim)' }}>{s.content}</pre>}
              </div>
            )}
          </div>
        ))}
        {editingId === null && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加写作技能</h4>
            <div className="space-y-1.5">
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs outline-none"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                placeholder="技能名称（如：感官描写法、对话节奏控制）" />
              <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs outline-none"
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                placeholder="分类（如：描写、对话、叙事）" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs resize-none outline-none" rows={2}
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                placeholder="技能描述" />
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs resize-none outline-none font-mono" rows={5}
                style={{ color: 'var(--color-text)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                placeholder="技能详细内容：具体的写作技巧和操作方法" />
              <button onClick={() => handleSave()} disabled={!form.name.trim()}
                className="w-full rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600 disabled:opacity-50">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SkillsPanel
