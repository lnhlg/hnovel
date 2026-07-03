import React, { useState, useEffect } from 'react'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useLayoutStore } from '../store/layout'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'
import AIChatDialog from './dialogs/AIChatDialog'

export default function WorldSettingsPanel(): JSX.Element {
  const { currentProject, worldSettings, loadWorldSettings, saveWorldSetting, deleteWorldSetting, aiGenerate } = useAppStore()
  const openDoc = useLayoutStore((s) => s.openDoc)
  const [editingSetting, setEditingSetting] = useState<typeof worldSettings[0] | null>(null)
  const [newSetting, setNewSetting] = useState({ category: '', key: '', value: '', description: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(5)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadWorldSettings(currentProject.id)
    }
  }, [currentProject?.id])

  const handleSave = async () => {
    if (!currentProject) return
    if (editingSetting) {
      await saveWorldSetting({ ...editingSetting, projectId: currentProject.id })
    } else {
      await saveWorldSetting({ ...newSetting, projectId: currentProject.id })
      setNewSetting({ category: '', key: '', value: '', description: '' })
    }
    setEditingSetting(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个设定吗？')) return
    await deleteWorldSetting(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'world', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { category: string; key: string; value: string; description: string; rules: string; relatedSettings: string; plotImpact: string; limitations: string; examples: string }
      if (!data?.key) { alert('AI 返回的数据格式不正确'); return }
      await saveWorldSetting({ projectId: currentProject.id, category: data.category ?? '', key: data.key, value: data.value ?? '', description: data.description ?? '', rules: data.rules ?? '', relatedSettings: data.relatedSettings ?? '', plotImpact: data.plotImpact ?? '', limitations: data.limitations ?? '', examples: data.examples ?? '' })
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
      const result = await aiGenerate({ type: 'world-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) { alert('AI 返回的数据格式不正确'); return }
      for (const item of arr) {
        const w = item as { category: string; key: string; value: string; description: string; rules: string; relatedSettings: string; plotImpact: string; limitations: string; examples: string }
        if (!w.key) continue
        await saveWorldSetting({ projectId: currentProject.id, category: w.category ?? '', key: w.key, value: w.value ?? '', description: w.description ?? '', rules: w.rules ?? '', relatedSettings: w.relatedSettings ?? '', plotImpact: w.plotImpact ?? '', limitations: w.limitations ?? '', examples: w.examples ?? '' })
      }
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleOpenDoc = (setting: typeof worldSettings[0]) => {
    openDoc({
      id: `worldSetting:${setting.id}`,
      type: 'worldSetting',
      title: setting.key,
      entityId: setting.id,
      content: '',
      dirty: false
    })
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看世界观设定</div>
  }

  const categories = [...new Set(worldSettings.map(s => s.category))]

  return (
    <>
    <AIChatDialog
      open={showAiChat}
      onClose={() => setShowAiChat(false)}
      entityType="worldSetting"
      projectId={currentProject.id}
    />
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          世界观设定 ({worldSettings.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiChat(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
            style={{ color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-light)' }}
            title="AI 对话创建设定"
          >
            <MessageSquare size={12} />
            <span>对话</span>
          </button>
          <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成设定" />
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
        oneLabel="生成 1 条"
      />

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {categories.length > 0 ? (
          categories.map(category => (
            <div key={category || '未分类'}>
              <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-accent)' }}>
                {category || '未分类'}
              </h4>
              <div className="space-y-2">
                {worldSettings
                  .filter(s => s.category === category)
                  .map(setting => (
                    <div key={setting.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
                      {editingSetting?.id === setting.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editingSetting.key} onChange={(e) => setEditingSetting({ ...editingSetting, key: e.target.value })} className="input w-full text-xs" placeholder="设定名称" />
                          <input type="text" value={editingSetting.value} onChange={(e) => setEditingSetting({ ...editingSetting, value: e.target.value })} className="input w-full text-xs" placeholder="设定值" />
                          <textarea value={editingSetting.description} onChange={(e) => setEditingSetting({ ...editingSetting, description: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="详细说明" />
                          <div className="flex gap-1">
                            <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                            <button onClick={() => setEditingSetting(null)} className="btn btn-ghost text-xs py-1">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className="text-sm font-medium cursor-pointer hover:underline"
                              onClick={() => handleOpenDoc(setting)}
                              style={{ color: 'var(--color-text)' }}
                              title="点击在编辑器中打开"
                            >
                              {setting.key}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleOpenDoc(setting)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-text-muted)' }}
                                title="打开文档"
                              >
                                <ExternalLink size={12} />
                              </button>
                              <button
                                onClick={() => setEditingSetting(setting)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDelete(setting.id)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--color-danger)' }}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                          {setting.value && <p className="mt-1 text-xs" style={{ color: 'var(--color-accent)' }}>{setting.value}</p>}
                          {setting.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{setting.description}</p>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无世界观设定</p>
        )}

        {!editingSetting && (
          <div className="rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加新设定</h4>
            <div className="space-y-1.5">
              <input type="text" value={newSetting.category} onChange={(e) => setNewSetting({ ...newSetting, category: e.target.value })} className="input w-full text-xs" placeholder="分类（如魔法体系、社会制度）" />
              <input type="text" value={newSetting.key} onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value })} className="input w-full text-xs" placeholder="设定名称" />
              <input type="text" value={newSetting.value} onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })} className="input w-full text-xs" placeholder="设定值" />
              <textarea value={newSetting.description} onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="详细说明" />
              <button onClick={handleSave} disabled={!newSetting.key.trim()} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
