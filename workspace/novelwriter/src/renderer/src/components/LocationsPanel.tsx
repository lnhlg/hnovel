import React, { useState, useEffect } from 'react'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useLayoutStore } from '../store/layout'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'
import AIChatDialog from './dialogs/AIChatDialog'

export default function LocationsPanel(): JSX.Element {
  const { currentProject, locations, loadLocations, saveLocation, deleteLocation, aiGenerate } = useAppStore()
  const openDoc = useLayoutStore((s) => s.openDoc)
  const [editingLocation, setEditingLocation] = useState<typeof locations[0] | null>(null)
  const [newLocation, setNewLocation] = useState({ name: '', description: '', type: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(5)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadLocations(currentProject.id)
    }
  }, [currentProject?.id])

  const handleSave = async () => {
    if (!currentProject) return
    if (editingLocation) {
      await saveLocation({ ...editingLocation, projectId: currentProject.id })
    } else {
      await saveLocation({ ...newLocation, projectId: currentProject.id })
      setNewLocation({ name: '', description: '', type: '' })
    }
    setEditingLocation(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个地点吗？')) return
    await deleteLocation(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'location', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { name: string; type: string; description: string }
      if (!data?.name) { alert('AI 返回的数据格式不正确'); return }
      await saveLocation({ projectId: currentProject.id, name: data.name, type: data.type ?? '', description: data.description ?? '' })
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
      const result = await aiGenerate({ type: 'location-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) { alert('AI 返回的数据格式不正确'); return }
      for (const item of arr) {
        const l = item as { name: string; type: string; description: string }
        if (!l.name) continue
        await saveLocation({ projectId: currentProject.id, name: l.name, type: l.type ?? '', description: l.description ?? '' })
      }
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleOpenDoc = (location: typeof locations[0]) => {
    openDoc({
      id: `location:${location.id}`,
      type: 'location',
      title: location.name,
      entityId: location.id,
      content: '',
      dirty: false
    })
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看地点场景</div>
  }

  const types = [...new Set(locations.map(l => l.type))]

  return (
    <>
    <AIChatDialog
      open={showAiChat}
      onClose={() => setShowAiChat(false)}
      entityType="location"
      projectId={currentProject.id}
    />
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          地点场景 ({locations.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiChat(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
            style={{ color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-light)' }}
            title="AI 对话创建地点"
          >
            <MessageSquare size={12} />
            <span>对话</span>
          </button>
          <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成地点" />
        </div>
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

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {types.length > 0 ? (
          types.map(type => (
            <div key={type || '未分类'}>
              <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-accent)' }}>
                {type || '未分类'}
              </h4>
              <div className="space-y-2">
                {locations
                  .filter(l => l.type === type)
                  .map(location => (
                    <div key={location.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
                      {editingLocation?.id === location.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingLocation.name}
                            onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="地点名称"
                          />
                          <input
                            type="text"
                            value={editingLocation.type}
                            onChange={(e) => setEditingLocation({ ...editingLocation, type: e.target.value })}
                            className="input w-full text-xs"
                            placeholder="地点类型"
                          />
                          <textarea
                            value={editingLocation.description}
                            onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                            className="textarea w-full text-xs"
                            rows={2}
                            placeholder="地点描述"
                          />
                          <div className="flex gap-1">
                            <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                            <button onClick={() => setEditingLocation(null)} className="btn btn-ghost text-xs py-1">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className="text-sm font-medium cursor-pointer hover:underline"
                              onClick={() => handleOpenDoc(location)}
                              style={{ color: 'var(--color-text)' }}
                              title="点击在编辑器中打开"
                            >
                              {location.name}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleOpenDoc(location)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-text-muted)' }}
                                title="打开文档"
                              >
                                <ExternalLink size={12} />
                              </button>
                              <button
                                onClick={() => setEditingLocation(location)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDelete(location.id)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-danger)' }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                          {location.type && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{location.type}</span>}
                          {location.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{location.description}</p>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无地点场景</p>
        )}

        {!editingLocation && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加新地点</h4>
            <div className="space-y-1.5">
              <input
                type="text"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                className="input w-full text-xs"
                placeholder="地点名称"
              />
              <input
                type="text"
                value={newLocation.type}
                onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
                className="input w-full text-xs"
                placeholder="地点类型（如城市、森林、城堡）"
              />
              <textarea
                value={newLocation.description}
                onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                className="textarea w-full text-xs"
                rows={2}
                placeholder="地点描述"
              />
              <button onClick={handleSave} disabled={!newLocation.name.trim()} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
