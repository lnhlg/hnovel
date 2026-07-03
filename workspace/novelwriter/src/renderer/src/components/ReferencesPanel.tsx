import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'

export default function ReferencesPanel(): JSX.Element {
  const { currentProject, references, loadReferences, saveReference, deleteReference, aiGenerate } = useAppStore()
  const [editingReference, setEditingReference] = useState<typeof references[0] | null>(null)
  const [newReference, setNewReference] = useState({ title: '', type: '', url: '', notes: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(5)
  const [showAiPanel, setShowAiPanel] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadReferences(currentProject.id)
    }
  }, [currentProject?.id])

  const handleSave = async () => {
    if (!currentProject) return
    if (editingReference) {
      await saveReference({ ...editingReference, projectId: currentProject.id })
    } else {
      await saveReference({ ...newReference, projectId: currentProject.id })
      setNewReference({ title: '', type: '', url: '', notes: '' })
    }
    setEditingReference(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个参考资料吗？')) return
    await deleteReference(id)
  }

  const handleOpenUrl = (url: string) => {
    if (url && url.startsWith('http')) {
      window.open(url, '_blank')
    }
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'reference', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { title: string; type: string; url: string; notes: string }
      if (!data?.title) { alert('AI 返回的数据格式不正确'); return }
      await saveReference({ projectId: currentProject.id, title: data.title, type: data.type ?? '', url: data.url ?? '', notes: data.notes ?? '' })
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
      const result = await aiGenerate({ type: 'reference-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) { alert('AI 返回的数据格式不正确'); return }
      for (const item of arr) {
        const r = item as { title: string; type: string; url: string; notes: string }
        if (!r.title) continue
        await saveReference({ projectId: currentProject.id, title: r.title, type: r.type ?? '', url: r.url ?? '', notes: r.notes ?? '' })
      }
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看参考资料</div>
  }

  const types = [...new Set(references.map(r => r.type))]

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          参考资料 ({references.length})
        </span>
        <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成参考资料" />
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
                {references
                  .filter(r => r.type === type)
                  .map(reference => (
                    <div key={reference.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
                      {editingReference?.id === reference.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingReference.title}
                            onChange={(e) => setEditingReference({ ...editingReference, title: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="资料标题"
                          />
                          <input
                            type="text"
                            value={editingReference.type}
                            onChange={(e) => setEditingReference({ ...editingReference, type: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="资料类型"
                          />
                          <input
                            type="text"
                            value={editingReference.url}
                            onChange={(e) => setEditingReference({ ...editingReference, url: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="链接地址"
                          />
                          <textarea
                            value={editingReference.notes}
                            onChange={(e) => setEditingReference({ ...editingReference, notes: e.target.value })}
                            className="textarea w-full text-xs"
                            rows={2}
                            placeholder="备注信息"
                          />
                          <div className="flex gap-1">
                            <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                            <button onClick={() => setEditingReference(null)} className="btn btn-ghost text-xs py-1">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium">{reference.title}</span>
                              {reference.url && (
                                <button onClick={() => handleOpenUrl(reference.url)} className="text-xs" style={{ color: 'var(--color-accent)' }}>🔗</button>
                              )}
                            </div>
                            <div className="hidden group-hover:flex gap-1">
                              <button onClick={() => setEditingReference(reference)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                              <button onClick={() => handleDelete(reference.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                            </div>
                          </div>
                          {reference.type && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{reference.type}</span>}
                          {reference.url && !reference.url.startsWith('http') && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{reference.url}</p>}
                          {reference.notes && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{reference.notes}</p>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无参考资料</p>
        )}

        {!editingReference && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加参考资料</h4>
            <div className="space-y-1.5">
              <input
                type="text"
                value={newReference.title}
                onChange={(e) => setNewReference({ ...newReference, title: e.target.value })}
                className="input w-full text-xs"
                placeholder="资料标题"
              />
              <input
                type="text"
                value={newReference.type}
                onChange={(e) => setNewReference({ ...newReference, type: e.target.value })}
                className="input w-full text-xs"
                placeholder="资料类型（如书籍、文章、图片）"
              />
              <input
                type="text"
                value={newReference.url}
                onChange={(e) => setNewReference({ ...newReference, url: e.target.value })}
                className="input w-full text-xs"
                placeholder="链接地址"
              />
              <textarea
                value={newReference.notes}
                onChange={(e) => setNewReference({ ...newReference, notes: e.target.value })}
                className="textarea w-full text-xs"
                rows={2}
                placeholder="备注信息"
              />
              <button onClick={handleSave} disabled={!newReference.title.trim()} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
