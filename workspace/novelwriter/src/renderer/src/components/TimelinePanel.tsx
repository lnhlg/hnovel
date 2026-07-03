import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'

export default function TimelinePanel(): JSX.Element {
  const { currentProject, timelines, loadTimelines, saveTimeline, deleteTimeline, aiGenerate } = useAppStore()
  const [editingTimeline, setEditingTimeline] = useState<typeof timelines[0] | null>(null)
  const [newTimeline, setNewTimeline] = useState({ title: '', description: '', date: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(5)
  const [showAiPanel, setShowAiPanel] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadTimelines(currentProject.id)
    }
  }, [currentProject?.id])

  const handleSave = async () => {
    if (!currentProject) return
    if (editingTimeline) {
      await saveTimeline({ ...editingTimeline, projectId: currentProject.id })
    } else {
      await saveTimeline({ ...newTimeline, projectId: currentProject.id })
      setNewTimeline({ title: '', description: '', date: '' })
    }
    setEditingTimeline(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个时间节点吗？')) return
    await deleteTimeline(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'timeline', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { title: string; date: string; description: string }
      if (!data?.title) { alert('AI 返回的数据格式不正确'); return }
      const maxOrder = timelines.reduce((m, t) => Math.max(m, t.sortOrder), 0)
      await saveTimeline({ projectId: currentProject.id, title: data.title, date: data.date ?? '', description: data.description ?? '', sortOrder: maxOrder + 1 })
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
      const result = await aiGenerate({ type: 'timeline-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) { alert('AI 返回的数据格式不正确'); return }
      let order = timelines.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1
      for (const item of arr) {
        const t = item as { title: string; date: string; description: string }
        if (!t.title) continue
        await saveTimeline({ projectId: currentProject.id, title: t.title, date: t.date ?? '', description: t.description ?? '', sortOrder: order++ })
      }
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看时间线</div>
  }

  const sortedTimelines = [...timelines].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          时间线 ({timelines.length})
        </span>
        <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成时间节点" />
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
        oneLabel="生成 1 个"
      />

      <div className="flex-1 overflow-auto p-3">
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--color-border-light)' }} />
          
          <div className="space-y-3">
            {sortedTimelines.length > 0 ? (
              sortedTimelines.map((timeline, index) => (
                <div key={timeline.id} className="relative pl-6">
                  <div
                    className="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                  >
                    {index + 1}
                  </div>
                  
                  <div className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
                    {editingTimeline?.id === timeline.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingTimeline.title}
                          onChange={(e) => setEditingTimeline({ ...editingTimeline, title: e.target.value })}
                          className="input w-full text-xs"
                          placeholder="时间节点名称"
                        />
                        <input
                          type="text"
                          value={editingTimeline.date}
                          onChange={(e) => setEditingTimeline({ ...editingTimeline, date: e.target.value })}
                          className="input w-full text-xs"
                          placeholder="时间"
                        />
                        <textarea
                          value={editingTimeline.description}
                          onChange={(e) => setEditingTimeline({ ...editingTimeline, description: e.target.value })}
                          className="textarea w-full text-xs"
                          rows={2}
                          placeholder="事件描述"
                        />
                        <div className="flex gap-1">
                          <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                          <button onClick={() => setEditingTimeline(null)} className="btn btn-ghost text-xs py-1">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{timeline.title}</span>
                          <div className="hidden group-hover:flex gap-1">
                            <button onClick={() => setEditingTimeline(timeline)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                            <button onClick={() => handleDelete(timeline.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                          </div>
                        </div>
                        {timeline.date && <p className="mt-1 text-xs" style={{ color: 'var(--color-accent)' }}>{timeline.date}</p>}
                        {timeline.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{timeline.description}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无时间节点</p>
            )}
          </div>
        </div>

        {!editingTimeline && (
          <div className="mt-3 rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加时间节点</h4>
            <div className="space-y-1.5">
              <input
                type="text"
                value={newTimeline.title}
                onChange={(e) => setNewTimeline({ ...newTimeline, title: e.target.value })}
                className="input w-full text-xs"
                placeholder="时间节点名称"
              />
              <input
                type="text"
                value={newTimeline.date}
                onChange={(e) => setNewTimeline({ ...newTimeline, date: e.target.value })}
                className="input w-full text-xs"
                placeholder="时间"
              />
              <textarea
                value={newTimeline.description}
                onChange={(e) => setNewTimeline({ ...newTimeline, description: e.target.value })}
                className="textarea w-full text-xs"
                rows={2}
                placeholder="事件描述"
              />
              <button onClick={handleSave} disabled={!newTimeline.title.trim()} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
