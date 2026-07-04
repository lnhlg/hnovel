import React, { useState, useEffect } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { useAppStore } from '../../store/app'

interface Props {
  open: boolean
  onClose: () => void
  sourceText: string
  projectId: string
}

export default function ExtractCharactersDialog({ open, onClose, sourceText, projectId }: Props): JSX.Element | null {
  const { saveCharacter, loadCharacters } = useAppStore()
  const [extracted, setExtracted] = useState<{ name: string; description: string; appearance: string; personality: string; checked: boolean }[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !sourceText.trim()) return

    const doExtract = async () => {
      setLoading(true)
      setError('')
      try {
        const messages = [
          {
            role: 'system' as const,
            content: `你是一个小说角色提取助手。从用户提供的文本中提取所有出现的角色（人物）。

返回 JSON 数组，每个角色包含：
- name（姓名，必填）
- description（角色简介）
- appearance（外貌描写）
- personality（性格特点）

只返回 JSON 数组，不要其他文字。如果文本中没有角色，返回空数组 []。`
          },
          {
            role: 'user' as const,
            content: sourceText.slice(0, 15000)
          }
        ]

        const result = await window.api.aiChat(messages, { stream: false })

        // 尝试解析 JSON
        let parsed: { name: string; description?: string; appearance?: string; personality?: string }[] = []
        // 清理可能的额外文字
        let cleanResult = result.trim()
        // 如果包含 ``` 块，抽取第一个
        const fenceMatch = cleanResult.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (fenceMatch) cleanResult = fenceMatch[1].trim()
        try {
          parsed = JSON.parse(cleanResult)
        } catch {
          // 尝试查找 JSON 数组
          const arrMatch = cleanResult.match(/\[\s*\{[\s\S]*?\}\s*\]/)
          if (arrMatch) parsed = JSON.parse(arrMatch[0])
          else throw new Error('无法解析 AI 返回的 JSON')
        }

        if (Array.isArray(parsed)) {
          setExtracted(parsed.filter(c => c.name).map(c => ({
            name: c.name,
            description: c.description || '',
            appearance: c.appearance || '',
            personality: c.personality || '',
            checked: true
          })))
        }
      } catch (err) {
        setError('提取失败：' + (err instanceof Error ? err.message : String(err)))
      } finally {
        setLoading(false)
      }
    }

    doExtract()
  }, [open, sourceText])

  const toggleChecked = (idx: number) => {
    setExtracted(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c))
  }

  const handleSave = async () => {
    const selected = extracted.filter(c => c.checked)
    if (selected.length === 0) return
    setSaving(true)
    try {
      for (const c of selected) {
        await saveCharacter({
          projectId,
          name: c.name,
          description: c.description || '',
          appearance: c.appearance || '',
          personality: c.personality || '',
          role: '', age: 0, background: '', traits: '',
          skills: '', relationships: '', motivation: '', flaws: '', growthArc: '',
          gender: '', dynasty: '', birthplace: '', heightBuild: '',
          face: '', hairstyle: '', clothing: '', talents: '', likes: '',
          importantEvents: '', relationshipsDetail: '', weaknesses: '', specialMarks: ''
        })
      }
      await loadCharacters(projectId)
      onClose()
    } catch (err) {
      setError('保存失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div
        className="rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>提取角色</h2>
          <button onClick={onClose} className="icon-btn" style={{ width: 24, height: 24 }} disabled={loading || saving}>
            <X size={14} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>正在从文本中提取角色...</span>
            </div>
          )}

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          {!loading && !error && extracted.length === 0 && (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
              未从文本中识别出角色
            </div>
          )}

          {!loading && extracted.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                共识别出 {extracted.length} 个角色，勾选要保存的：
              </div>
              {extracted.map((c, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors"
                  style={{ border: '1px solid var(--color-border-light)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={c.checked}
                    onChange={() => toggleChecked(i)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{c.name}</div>
                    {c.description && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{c.description}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.appearance && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>外貌</span>}
                      {c.personality && <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>性格</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {!loading && extracted.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button onClick={onClose} className="btn btn-ghost text-xs py-1.5" disabled={saving}>
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || extracted.filter(c => c.checked).length === 0}
              className="btn btn-primary text-xs py-1.5 flex items-center gap-1"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              保存选中角色（{extracted.filter(c => c.checked).length}）
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
