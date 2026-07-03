import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'
import AIAssetBar, { AIToggleButton } from './AIAssetBar'

export default function CharacterRelationsPanel(): JSX.Element {
  const { currentProject, characterRelations, characters, loadCharacterRelations, loadCharacters, saveCharacterRelation, deleteCharacterRelation, aiGenerate } = useAppStore()
  const [editingRelation, setEditingRelation] = useState<typeof characterRelations[0] | null>(null)
  const [newRelation, setNewRelation] = useState({ characterId1: '', characterId2: '', relation: '', description: '' })
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadCharacterRelations(currentProject.id)
      loadCharacters(currentProject.id)
    }
  }, [currentProject?.id])

  const getCharacterName = (id: string) => characters.find(c => c.id === id)?.name || id

  const handleSave = async () => {
    if (!currentProject) return
    if (editingRelation) {
      await saveCharacterRelation({ ...editingRelation, projectId: currentProject.id })
    } else {
      await saveCharacterRelation({ ...newRelation, projectId: currentProject.id })
      setNewRelation({ characterId1: '', characterId2: '', relation: '', description: '' })
    }
    setEditingRelation(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个关系吗？')) return
    await deleteCharacterRelation(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    if (characters.length < 2) {
      alert('至少需要 2 个角色才能生成关系，请先添加角色')
      return
    }
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'relation', projectId: currentProject.id, hint: aiHint })
      if (result.error) { alert('AI 生成失败：' + result.error); return }
      const data = result.data as { characterId1: string; characterId2: string; relation: string; description: string }
      if (!data?.characterId1 || !data?.characterId2) { alert('AI 返回的数据格式不正确'); return }
      // AI 返回的是名字，需要根据名字查找 ID
      const c1 = characters.find(c => c.name === data.characterId1)
      const c2 = characters.find(c => c.name === data.characterId2)
      if (!c1 || !c2) {
        alert(`AI 返回了不存在的角色名：${data.characterId1} 或 ${data.characterId2}`)
        return
      }
      await saveCharacterRelation({ projectId: currentProject.id, characterId1: c1.id, characterId2: c2.id, relation: data.relation ?? '', description: data.description ?? '' })
      setAiHint('')
    } catch (err) {
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看角色关系</div>
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          角色关系 ({characterRelations.length})
        </span>
        <AIToggleButton active={showAiPanel} onClick={() => setShowAiPanel(v => !v)} title="AI 生成关系" />
      </div>

      <AIAssetBar
        show={showAiPanel}
        onToggle={() => setShowAiPanel(v => !v)}
        hint={aiHint}
        onHintChange={setAiHint}
        batchCount={1}
        onBatchCountChange={() => {}}
        loading={aiLoading}
        onGenerateOne={handleAiGenerateOne}
        onGenerateBatch={() => {}}
        oneLabel="AI 推荐关系"
        hideBatch
      />

      <div className="flex-1 overflow-auto p-3 space-y-2 h-full">
        {characterRelations.length > 0 ? (
          characterRelations.map(relation => (
            <div key={relation.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
              {editingRelation?.id === relation.id ? (
                <div className="space-y-2">
                  <select
                    value={editingRelation.characterId1}
                    onChange={(e) => setEditingRelation({ ...editingRelation, characterId1: e.target.value })}
                    className="input w-full text-xs"
                  >
                    <option value="">选择角色1</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={editingRelation.characterId2}
                    onChange={(e) => setEditingRelation({ ...editingRelation, characterId2: e.target.value })}
                    className="input w-full text-xs"
                  >
                    <option value="">选择角色2</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={editingRelation.relation}
                    onChange={(e) => setEditingRelation({ ...editingRelation, relation: e.target.value })}
                    className="input w-full text-xs"
                    placeholder="关系类型"
                  />
                  <textarea
                    value={editingRelation.description}
                    onChange={(e) => setEditingRelation({ ...editingRelation, description: e.target.value })}
                    className="textarea w-full text-xs"
                    rows={2}
                    placeholder="关系描述"
                  />
                  <div className="flex gap-1">
                    <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                    <button onClick={() => setEditingRelation(null)} className="btn btn-ghost text-xs py-1">取消</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getCharacterName(relation.characterId1)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                        {relation.relation}
                      </span>
                      <span className="text-sm">{getCharacterName(relation.characterId2)}</span>
                    </div>
                    <div className="hidden group-hover:flex gap-1">
                      <button onClick={() => setEditingRelation(relation)} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>编辑</button>
                      <button onClick={() => handleDelete(relation.id)} className="text-xs" style={{ color: 'var(--color-danger)' }}>删除</button>
                    </div>
                  </div>
                  {relation.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{relation.description}</p>}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无角色关系</p>
        )}

        {!editingRelation && (
          <div className="mt-3 rounded-lg p-3" style={{ border: '1px dashed var(--color-border)' }}>
            <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>添加角色关系</h4>
            <div className="space-y-1.5">
              <select
                value={newRelation.characterId1}
                onChange={(e) => setNewRelation({ ...newRelation, characterId1: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="">选择角色1</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={newRelation.characterId2}
                onChange={(e) => setNewRelation({ ...newRelation, characterId2: e.target.value })}
                className="input w-full text-xs"
              >
                <option value="">选择角色2</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={newRelation.relation}
                onChange={(e) => setNewRelation({ ...newRelation, relation: e.target.value })}
                className="input w-full text-xs"
                placeholder="关系类型（如朋友、敌人、亲属）"
              />
              <textarea
                value={newRelation.description}
                onChange={(e) => setNewRelation({ ...newRelation, description: e.target.value })}
                className="textarea w-full text-xs"
                rows={2}
                placeholder="关系描述"
              />
              <button onClick={handleSave} disabled={!newRelation.characterId1 || !newRelation.characterId2 || !newRelation.relation} className="btn btn-primary text-xs py-1 w-full">添加</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
