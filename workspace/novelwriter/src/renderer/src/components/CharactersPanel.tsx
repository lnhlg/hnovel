import React, { useState } from 'react'
import { Sparkles, ExternalLink, MessageSquare } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useLayoutStore } from '../store/layout'
import AIChatDialog from './dialogs/AIChatDialog'

export default function CharactersPanel(): JSX.Element {
  const { currentProject, characters, saveCharacter, deleteCharacter, aiGenerate } = useAppStore()
  const openDoc = useLayoutStore((s) => s.openDoc)
  const [editingChar, setEditingChar] = useState<typeof characters[0] | null>(null)
  const [newCharName, setNewCharName] = useState('')
  const [aiHint, setAiHint] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [batchCount, setBatchCount] = useState(3)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showAiChat, setShowAiChat] = useState(false)

  const handleSave = async () => {
    if (!currentProject || !editingChar) return
    await saveCharacter({
      id: editingChar.id,
      projectId: currentProject.id,
      name: editingChar.name,
      description: editingChar.description,
      traits: editingChar.traits,
      age: editingChar.age,
      appearance: editingChar.appearance,
      background: editingChar.background,
      personality: editingChar.personality,
      role: editingChar.role,
      skills: editingChar.skills,
      relationships: editingChar.relationships,
      motivation: editingChar.motivation,
      flaws: editingChar.flaws,
      growthArc: editingChar.growthArc,
      gender: editingChar.gender,
      dynasty: editingChar.dynasty,
      birthplace: editingChar.birthplace,
      heightBuild: editingChar.heightBuild,
      face: editingChar.face,
      hairstyle: editingChar.hairstyle,
      clothing: editingChar.clothing,
      talents: editingChar.talents,
      likes: editingChar.likes,
      importantEvents: editingChar.importantEvents,
      relationshipsDetail: editingChar.relationshipsDetail,
      weaknesses: editingChar.weaknesses,
      specialMarks: editingChar.specialMarks
    })
    setEditingChar(null)
  }

  const handleAdd = async () => {
    if (!currentProject || !newCharName.trim()) return
    await saveCharacter({
      projectId: currentProject.id,
      name: newCharName.trim(),
      description: '', traits: '', age: 0, appearance: '', background: '',
      personality: '', role: '', skills: '', relationships: '',
      motivation: '', flaws: '', growthArc: '',
      gender: '', dynasty: '', birthplace: '',
      heightBuild: '', face: '', hairstyle: '', clothing: '',
      talents: '', likes: '', importantEvents: '',
      relationshipsDetail: '', weaknesses: '', specialMarks: ''
    })
    setNewCharName('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个角色吗？')) return
    await deleteCharacter(id)
  }

  const handleAiGenerateOne = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'character', projectId: currentProject.id, hint: aiHint })
      if (result.error) {
        alert('AI 生成失败：' + result.error)
        return
      }
      const data = result.data as Record<string, unknown>
      if (!data?.name) {
        alert('AI 返回的数据格式不正确')
        return
      }
      await saveCharacter({
        projectId: currentProject.id,
        name: String(data.name),
        role: String(data.role ?? ''),
        age: Number(data.age ?? 0),
        appearance: String(data.appearance ?? ''),
        personality: String(data.personality ?? ''),
        background: String(data.background ?? ''),
        description: String(data.description ?? ''),
        traits: String(data.traits ?? ''),
        skills: String(data.skills ?? ''),
        relationships: String(data.relationships ?? ''),
        motivation: String(data.motivation ?? ''),
        flaws: String(data.flaws ?? ''),
        growthArc: String(data.growthArc ?? ''),
        gender: String(data.gender ?? ''),
        dynasty: String(data.dynasty ?? ''),
        birthplace: String(data.birthplace ?? ''),
        heightBuild: String(data.heightBuild ?? ''),
        face: String(data.face ?? ''),
        hairstyle: String(data.hairstyle ?? ''),
        clothing: String(data.clothing ?? ''),
        talents: String(data.talents ?? ''),
        likes: String(data.likes ?? ''),
        importantEvents: String(data.importantEvents ?? ''),
        relationshipsDetail: String(data.relationshipsDetail ?? ''),
        weaknesses: String(data.weaknesses ?? ''),
        specialMarks: String(data.specialMarks ?? '')
      })
      setAiHint('')
    } catch (err) {
      console.error(err)
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiGenerateBatch = async () => {
    if (!currentProject) return
    setAiLoading(true)
    try {
      const result = await aiGenerate({ type: 'character-batch', projectId: currentProject.id, hint: aiHint, count: batchCount })
      if (result.error) {
        alert('AI 生成失败：' + result.error)
        return
      }
      const arr = Array.isArray(result.data) ? result.data : []
      if (arr.length === 0) {
        alert('AI 返回的数据格式不正确')
        return
      }
      for (const item of arr) {
        const c = item as Record<string, unknown>
        if (!c.name) continue
        await saveCharacter({
          projectId: currentProject.id,
          name: String(c.name),
          role: String(c.role ?? ''),
          age: Number(c.age ?? 0),
          appearance: String(c.appearance ?? ''),
          personality: String(c.personality ?? ''),
          background: String(c.background ?? ''),
          description: String(c.description ?? ''),
          traits: String(c.traits ?? ''),
          skills: String(c.skills ?? ''),
          relationships: String(c.relationships ?? ''),
          motivation: String(c.motivation ?? ''),
          flaws: String(c.flaws ?? ''),
          growthArc: String(c.growthArc ?? ''),
          gender: String(c.gender ?? ''),
          dynasty: String(c.dynasty ?? ''),
          birthplace: String(c.birthplace ?? ''),
          heightBuild: String(c.heightBuild ?? ''),
          face: String(c.face ?? ''),
          hairstyle: String(c.hairstyle ?? ''),
          clothing: String(c.clothing ?? ''),
          talents: String(c.talents ?? ''),
          likes: String(c.likes ?? ''),
          importantEvents: String(c.importantEvents ?? ''),
          relationshipsDetail: String(c.relationshipsDetail ?? ''),
          weaknesses: String(c.weaknesses ?? ''),
          specialMarks: String(c.specialMarks ?? '')
        })
      }
      setAiHint('')
    } catch (err) {
      console.error(err)
      alert('AI 生成失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const handleOpenDoc = (char: typeof characters[0]) => {
    openDoc({
      id: `character:${char.id}`,
      type: 'character',
      title: char.name,
      entityId: char.id,
      content: '',
      dirty: false
    })
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看角色</div>
  }

  return (
    <>
    <AIChatDialog
      open={showAiChat}
      onClose={() => setShowAiChat(false)}
      entityType="character"
      projectId={currentProject.id}
    />
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          角色 ({characters.length})
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAiChat(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
            style={{ color: 'var(--color-accent)', backgroundColor: 'var(--color-accent-light)' }}
            title="AI 对话创建角色"
          >
            <MessageSquare size={12} />
            <span>对话</span>
          </button>
          <button
            onClick={() => setShowAiPanel(v => !v)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
            style={{ color: showAiPanel ? 'var(--color-accent)' : 'var(--color-text-muted)', backgroundColor: showAiPanel ? 'var(--color-accent-light)' : 'transparent' }}
            title="AI 生成角色"
          >
            <Sparkles size={12} />
            <span>AI</span>
          </button>
        </div>
      </div>

      {showAiPanel && (
        <div className="px-3 py-2 space-y-1.5" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <textarea
            value={aiHint}
            onChange={(e) => setAiHint(e.target.value)}
            className="textarea w-full text-xs"
            rows={2}
            placeholder="提示（可选）：例如需要一位神秘的女剑客、主角的宿敌..."
          />
          <div className="flex gap-1">
            <button
              onClick={handleAiGenerateOne}
              disabled={aiLoading}
              className="btn btn-primary text-xs py-1 flex-1"
            >
              {aiLoading ? '生成中...' : '生成 1 个'}
            </button>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={10}
                value={batchCount}
                onChange={(e) => setBatchCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="input text-xs w-10 py-1"
                title="批量数量"
              />
              <button
                onClick={handleAiGenerateBatch}
                disabled={aiLoading}
                className="btn btn-ghost text-xs py-1"
                style={{ color: 'var(--color-accent)' }}
              >
                批量
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {characters.map((c) => (
          <div key={c.id} className="group rounded-lg p-2.5 transition-colors" style={{ border: '1px solid var(--color-border-light)' }}>
            {editingChar?.id === c.id ? (
              <div className="space-y-2">
                <details open>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>基本信息</summary>
                  <div className="mt-1 space-y-1.5">
                    <input type="text" value={editingChar.name} onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })} className="input w-full text-xs" placeholder="姓名" />
                    <div className="flex gap-1">
                      <input type="text" value={editingChar.gender} onChange={(e) => setEditingChar({ ...editingChar, gender: e.target.value })} className="input flex-1 text-xs" placeholder="性别" />
                      <input type="number" value={editingChar.age || ''} onChange={(e) => setEditingChar({ ...editingChar, age: parseInt(e.target.value) || 0 })} className="input w-20 text-xs" placeholder="年龄" />
                    </div>
                    <input type="text" value={editingChar.dynasty} onChange={(e) => setEditingChar({ ...editingChar, dynasty: e.target.value })} className="input w-full text-xs" placeholder="朝代" />
                    <input type="text" value={editingChar.birthplace} onChange={(e) => setEditingChar({ ...editingChar, birthplace: e.target.value })} className="input w-full text-xs" placeholder="籍贯" />
                    <input type="text" value={editingChar.role} onChange={(e) => setEditingChar({ ...editingChar, role: e.target.value })} className="input w-full text-xs" placeholder="角色定位" />
                  </div>
                </details>
                <details>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>身材</summary>
                  <div className="mt-1 space-y-1.5">
                    <textarea value={editingChar.heightBuild} onChange={(e) => setEditingChar({ ...editingChar, heightBuild: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="身材（体型、曲线等）" />
                  </div>
                </details>
                <details>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>外貌特征</summary>
                  <div className="mt-1 space-y-1.5">
                    <textarea value={editingChar.appearance} onChange={(e) => setEditingChar({ ...editingChar, appearance: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="外貌（简述）" />
                    <textarea value={editingChar.face} onChange={(e) => setEditingChar({ ...editingChar, face: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="面容" />
                    <textarea value={editingChar.hairstyle} onChange={(e) => setEditingChar({ ...editingChar, hairstyle: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="发型" />
                    <textarea value={editingChar.clothing} onChange={(e) => setEditingChar({ ...editingChar, clothing: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="衣着" />
                  </div>
                </details>
                <details>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>性格 & 背景</summary>
                  <div className="mt-1 space-y-1.5">
                    <textarea value={editingChar.personality} onChange={(e) => setEditingChar({ ...editingChar, personality: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="性格特点" />
                    <textarea value={editingChar.weaknesses} onChange={(e) => setEditingChar({ ...editingChar, weaknesses: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="性格弱点" />
                    <textarea value={editingChar.background} onChange={(e) => setEditingChar({ ...editingChar, background: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="背景故事" />
                    <textarea value={editingChar.description} onChange={(e) => setEditingChar({ ...editingChar, description: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="角色描述" />
                    <textarea value={editingChar.traits} onChange={(e) => setEditingChar({ ...editingChar, traits: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="性格特征（用逗号分隔）" />
                  </div>
                </details>
                <details>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>才艺 & 经历</summary>
                  <div className="mt-1 space-y-1.5">
                    <textarea value={editingChar.skills} onChange={(e) => setEditingChar({ ...editingChar, skills: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="技能" />
                    <textarea value={editingChar.talents} onChange={(e) => setEditingChar({ ...editingChar, talents: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="才艺专长" />
                    <textarea value={editingChar.likes} onChange={(e) => setEditingChar({ ...editingChar, likes: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="喜好厌恶" />
                    <textarea value={editingChar.importantEvents} onChange={(e) => setEditingChar({ ...editingChar, importantEvents: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="重要经历" />
                  </div>
                </details>
                <details>
                  <summary className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>关系 & 其他</summary>
                  <div className="mt-1 space-y-1.5">
                    <textarea value={editingChar.relationships} onChange={(e) => setEditingChar({ ...editingChar, relationships: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="关系（旧）" />
                    <textarea value={editingChar.relationshipsDetail} onChange={(e) => setEditingChar({ ...editingChar, relationshipsDetail: e.target.value })} className="textarea w-full text-xs" rows={2} placeholder="人际关系" />
                    <textarea value={editingChar.specialMarks} onChange={(e) => setEditingChar({ ...editingChar, specialMarks: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="特殊标记" />
                    <textarea value={editingChar.motivation} onChange={(e) => setEditingChar({ ...editingChar, motivation: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="动机" />
                    <textarea value={editingChar.flaws} onChange={(e) => setEditingChar({ ...editingChar, flaws: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="缺陷" />
                    <textarea value={editingChar.growthArc} onChange={(e) => setEditingChar({ ...editingChar, growthArc: e.target.value })} className="textarea w-full text-xs" rows={1} placeholder="成长弧光" />
                  </div>
                </details>
                <div className="flex gap-1 pt-1">
                  <button onClick={handleSave} className="btn btn-primary text-xs py-1">保存</button>
                  <button onClick={() => setEditingChar(null)} className="btn btn-ghost text-xs py-1">取消</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium cursor-pointer hover:underline"
                    onClick={() => handleOpenDoc(c)}
                    style={{ color: 'var(--color-text)' }}
                    title="点击在编辑器中打开"
                  >
                    {c.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenDoc(c)}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="打开文档"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={() => setEditingChar(c)}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.role && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{c.role}</span>}
                  {c.age > 0 && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-dim)' }}>{c.age}岁</span>}
                  {c.gender && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-dim)' }}>{c.gender}</span>}
                  {c.dynasty && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-dim)' }}>{c.dynasty}</span>}
                </div>
                {c.description && <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{c.description}</p>}
                {c.traits && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.traits.split(/[、,，\s]+/).filter(Boolean).map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>{t}</span>
                    ))}
                  </div>
                )}
                <details className="mt-1">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>完整资料</summary>
                  <div className="mt-1 space-y-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.gender && <p><span className="font-medium">性别：</span>{c.gender}</p>}
                    {c.dynasty && <p><span className="font-medium">朝代：</span>{c.dynasty}</p>}
                    {c.birthplace && <p><span className="font-medium">籍贯：</span>{c.birthplace}</p>}
                    {c.heightBuild && <p><span className="font-medium">身材：</span>{c.heightBuild}</p>}
                    {c.appearance && <p><span className="font-medium">外貌：</span>{c.appearance}</p>}
                    {c.face && <p><span className="font-medium">面容：</span>{c.face}</p>}
                    {c.hairstyle && <p><span className="font-medium">发型：</span>{c.hairstyle}</p>}
                    {c.clothing && <p><span className="font-medium">衣着：</span>{c.clothing}</p>}
                    {c.personality && <p><span className="font-medium">性格：</span>{c.personality}</p>}
                    {c.weaknesses && <p><span className="font-medium">弱点：</span>{c.weaknesses}</p>}
                    {c.skills && <p><span className="font-medium">技能：</span>{c.skills}</p>}
                    {c.talents && <p><span className="font-medium">才艺：</span>{c.talents}</p>}
                    {c.likes && <p><span className="font-medium">喜好：</span>{c.likes}</p>}
                    {c.importantEvents && <p><span className="font-medium">经历：</span>{c.importantEvents}</p>}
                    {c.relationships && <p><span className="font-medium">关系：</span>{c.relationships}</p>}
                    {c.relationshipsDetail && <p><span className="font-medium">人际关系：</span>{c.relationshipsDetail}</p>}
                    {c.specialMarks && <p><span className="font-medium">特殊标记：</span>{c.specialMarks}</p>}
                    {c.motivation && <p><span className="font-medium">动机：</span>{c.motivation}</p>}
                    {c.flaws && <p><span className="font-medium">缺陷：</span>{c.flaws}</p>}
                    {c.growthArc && <p><span className="font-medium">成长弧光：</span>{c.growthArc}</p>}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
        {!editingChar && (
          <div className="flex gap-1 pt-1">
            <input type="text" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="输入角色名..." className="input flex-1 text-xs" />
            <button onClick={handleAdd} disabled={!newCharName.trim()} className="btn btn-primary text-xs py-1">添加</button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}
