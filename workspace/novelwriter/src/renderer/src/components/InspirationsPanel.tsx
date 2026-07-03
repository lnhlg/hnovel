import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'

export default function InspirationsPanel(): JSX.Element {
  const { currentProject, inspirations, loadInspirations, saveInspiration, deleteInspiration, aiGenerate } = useAppStore()
  const [editingInspiration, setEditingInspiration] = useState<typeof inspirations[0] | null>(null)
  const [newInspiration, setNewInspiration] = useState({ title: '', content: '', type: '', source: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(5)
  const [showAiPanel, setShowAiPanel] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadInspirations(currentProject.id)
    }
  }, [currentProject?.id])

  const handleSave = async () => {
    if (!currentProject) return
    if (editingInspiration) {
      await saveInspiration({ ...editingInspiration, projectId: currentProject.id })
    } else {
      await saveInspiration({ ...newInspiration, projectId: currentProject.id })
      setNewInspiration({ title: '', content: '', type: '', source: '' })
    }
    setEditingInspiration(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个灵感吗？')) return
    await deleteInspiration(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'inspiration', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { title: string; type: string; content: string; source: string }
      if (!data?.title) { alert('AI 返回的数据格式不正确'); return }
      await saveInspiration({ projectId: currentProject.id, title: data.title, type: data.type ?? '', content: data.content ?? '', source: data.source ?? 'AI 生成' })
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiGenerateBatch = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'inspiration-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) { alert('AI 返回的数据格式不正确'); return }
      for (const item of arr) {
        const i = item as { title: string; type: string; content: string; source: string }
        if (!i.title) continue
        await saveInspiration({ projectId: currentProject.id, title: i.title, type: i.type ?? '', content: i.content ?? '', source: i.source ?? 'AI 生成' })
      }
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看灵感记录</div>
  }

  const types = [...new Set(inspirations.map(i => i.type))]

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          灵感记录 ({inspirations.length})
        </span>
        <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成灵感" />
      </div>

      <AIAssetBar
        show={showAiPanel}
        onToggle={() => setShowAiPanel(v => !v)}
        hint={aiHint}
        onHintChange={setAiHint}
        batchCount={batchCount}
        onBatchCountChange={setBatchCount}
        loading={aiLoading}
        onGenerateOne={handleAiGenerateOne}
        onGenerateBatch={handleAiGenerateBatch}
        oneLabel="生成 1 条"
      />

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {types.length > 0 ? (
          types.map(type => (
            <div key={type || '未分类'}>
              <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-accent)' }}>
                {type || '未分类'}
              </h4>
              <div className="space-y-2">
                {inspirations
                  .filter(i => i.type === type)
                  .map(inspiration => (
                    <div key={inspiration.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
                      {editingInspiration?.id === inspiration.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingInspiration.title}
                            onChange={(e) => setEditingInspiration({ ...editingInspiration, title: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="灵感标题"
                          />
                          <input
                            type="text"
                            value={editingInspiration.type}
                            onChange={(e) => setEditingInspiration({ ...editingInspiration, type: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="灵感类型"
                          />
                          <textarea
                            value={editingInspiration.content}
                            onChange={(e) => setEditingInspiration({ ...editingInspiration, content: e.target.value })}
                            className="textarea w-full text-xs"
                            rows={3}
                            placeholder="灵感内容"
                          />
                          <input
                            type="text"
                            value={editingInspiration.source}
                            onChange={(e) => setEditingInspiration({ ...editingInspiration, source: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="来源"
                          />
                          <div className="flex gap-1">
                            <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                            <button onClick={() => setEditingInspiration(null)} className="btn btn-ghost text-xs py-1">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{inspiration.title}</span>
                            <div className="hidden group-hover:flex gap-1">
                              <button onClick={() => setEditingInspiration(inspiration)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                              <button onClick={() => handleDelete(inspiration.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                            </div>
                          </div>
                          {inspiration.type && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{inspiration.type}</span>}
                          {inspiration.content && <p className="mt-1 text-xs line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>{inspiration.content}</p>}
                          {inspiration.source && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>来源: {inspiration.source}</p>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无灵感记录</p>
        )}

        {!editingInspiration && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加新灵感</h4>
            <div className="space-y-1.5">
              <input
                type="text"
                value={newInspiration.title}
                onChange={(e) => setNewInspiration({ ...newInspiration, title: e.target.value })}
                className="input w-full text-xs"
                placeholder="灵感标题"
              />
              <input
                type="text"
                value={newInspiration.type}
                onChange={(e) => setNewInspiration({ ...newInspiration, type: e.target.value })}
                className="input w-full text-xs"
                placeholder="灵感类型（如剧情、人物、场景）"
              />
              <textarea
                value={newInspiration.content}
                onChange={(e) => setNewInspiration({ ...newInspiration, content: e.target.value })}
                className="textarea w-full text-xs"
                rows={3}
                placeholder="灵感内容"
              />
              <input
                type="text"
                value={newInspiration.source}
                onChange={(e) => setNewInspiration({ ...newInspiration, source: e.target.value })}
                className="input w-full text-xs"
                placeholder="来源（可选）"
              />
              <button onClick={handleSave} disabled={!newInspiration.title.trim()} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
