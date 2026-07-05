import React, { useState, useEffect, useRef } from 'react'
import { X, Loader2, Check } from 'lucide-react'
import { useAppStore } from '../../store/app'

interface Props {
  open: boolean
  onClose: () => void
  sourceText: string
  chapterContents?: string[]
  projectId: string
}

interface RawCharacter {
  name: string
  description?: string
  appearance?: string
  personality?: string
}

interface MergedCharacter {
  name: string
  description: string
  appearance: string
  personality: string
  sources: number[]
  checked: boolean
  existingId?: string
  isExisting: boolean
}

// 单次 AI 提取：从给定文本中提取角色，返回原始数组
async function extractFromText(text: string): Promise<RawCharacter[]> {
  if (!text.trim()) return []
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
      content: text.slice(0, 15000)
    }
  ]

  const result = await window.api.aiChat(messages, { stream: false })
  if (!result) return []

  // 清理可能的额外文字
  let cleanResult = result.trim()
  const fenceMatch = cleanResult.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleanResult = fenceMatch[1].trim()

  let parsed: RawCharacter[] = []
  try {
    parsed = JSON.parse(cleanResult)
  } catch {
    // 尝试查找所有 JSON 数组片段
    const jsonArrayRegex = /\[\s*\{[\s\S]+?\}\s*\]/g
    let m
    while ((m = jsonArrayRegex.exec(cleanResult)) !== null) {
      try {
        const candidate = JSON.parse(m[0])
        if (Array.isArray(candidate) && candidate.length > 0) {
          parsed = candidate
          break
        }
      } catch { }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      // 再次请求 AI 只输出 JSON
      const followUp = await window.api.aiChat([
        ...messages,
        { role: 'assistant', content: result },
        { role: 'user', content: '请只输出 JSON 数组，格式为[{"name":"角色名","description":"描述"}]，不要任何其他文字。' }
      ], { stream: false })
      if (followUp) {
        try {
          const clean2 = followUp.trim()
          const fence2 = clean2.match(/```(?:json)?\s*([\s\S]*?)```/)
          parsed = JSON.parse(fence2 ? fence2[1].trim() : clean2)
        } catch { }
      }
    }
  }

  return Array.isArray(parsed) ? parsed.filter(c => c && c.name) : []
}

// 合并同名角色（名字相同时合并 description/appearance/personality，记录来源章节）
// existingCharacters：已有角色列表，用于标记扫描结果中哪些已存在
function mergeCharacters(byChapter: RawCharacter[][], existingCharacters: { name: string; id: string }[] = []): MergedCharacter[] {
  const nameToId = new Map<string, string>(
    existingCharacters.map(c => [c.name.trim(), c.id])
  )
  const map = new Map<string, MergedCharacter>()
  byChapter.forEach((chars, chapterIdx) => {
    for (const c of chars) {
      const name = c.name.trim()
      if (!name) continue
      const existing = map.get(name)
      if (existing) {
        // 合并非空字段（保留首次出现的描述，缺失时补充）
        if (!existing.description && c.description) existing.description = c.description
        if (!existing.appearance && c.appearance) existing.appearance = c.appearance
        if (!existing.personality && c.personality) existing.personality = c.personality
        if (!existing.sources.includes(chapterIdx)) existing.sources.push(chapterIdx)
      } else {
        const existingId = nameToId.get(name)
        map.set(name, {
          name,
          description: c.description || '',
          appearance: c.appearance || '',
          personality: c.personality || '',
          sources: [chapterIdx],
          checked: true,
          existingId,
          isExisting: !!existingId
        })
      }
    }
  })
  return Array.from(map.values())
}

export default function ExtractCharactersDialog({ open, onClose, sourceText, chapterContents, projectId }: Props): JSX.Element | null {
  const { saveCharacter, loadCharacters, characters } = useAppStore()
  const [extracted, setExtracted] = useState<MergedCharacter[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!open) return
    cancelledRef.current = false

    const doExtract = async () => {
      setLoading(true)
      setError('')
      setExtracted([])
      setProgress(null)
      try {
        // 优先使用分章内容（避免一次性大文本截断导致角色遗漏）
        const chapters = (chapterContents || []).filter(c => c && c.trim())
        if (chapters.length === 0 && !sourceText.trim()) return

        const byChapter: RawCharacter[][] = []

        if (chapters.length > 0) {
          // 分章扫描，每章单独提取，避免大段文本截断和 AI 遗漏
          setProgress({ current: 0, total: chapters.length })
          for (let i = 0; i < chapters.length; i++) {
            if (cancelledRef.current) return
            setProgress({ current: i + 1, total: chapters.length })
            try {
              const chars = await extractFromText(chapters[i])
              byChapter.push(chars)
            } catch (err) {
              // 单章失败不阻断整体扫描，记录空结果
              console.error(`第 ${i + 1} 章扫描失败:`, err)
              byChapter.push([])
            }
          }
        } else if (sourceText.trim()) {
          // 回退：单文本扫描（按 14000 字符分段，避免一次截断丢角色）
          const SLICE = 14000
          const segments: string[] = []
          for (let i = 0; i < sourceText.length; i += SLICE) {
            segments.push(sourceText.slice(i, i + SLICE))
          }
          setProgress({ current: 0, total: segments.length })
          for (let i = 0; i < segments.length; i++) {
            if (cancelledRef.current) return
            setProgress({ current: i + 1, total: segments.length })
            try {
              const chars = await extractFromText(segments[i])
              byChapter.push(chars)
            } catch (err) {
              console.error(`第 ${i + 1} 段扫描失败:`, err)
              byChapter.push([])
            }
          }
        }

        if (cancelledRef.current) return
        const merged = mergeCharacters(byChapter, characters.map(c => ({ name: c.name, id: c.id })))
        setExtracted(merged)
      } catch (err) {
        setError('提取失败：' + (err instanceof Error ? err.message : String(err)))
      } finally {
        setLoading(false)
        setProgress(null)
      }
    }

    doExtract()
    return () => { cancelledRef.current = true }
  }, [open, sourceText, chapterContents])

  const toggleChecked = (idx: number) => {
    setExtracted(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c))
  }

  const handleSave = async () => {
    const selected = extracted.filter(c => c.checked)
    if (selected.length === 0) return
    setSaving(true)
    try {
      // 构建已有角色的 name -> character 映射，用于更新时合并字段
      const existingMap = new Map(characters.map(c => [c.id, c]))
      for (const c of selected) {
        if (c.existingId) {
          // 已有同名角色：合并新字段（只补充空字段，不覆盖已有内容）
          const existing = existingMap.get(c.existingId)
          if (existing) {
            await saveCharacter({
              id: existing.id,
              projectId,
              description: existing.description || c.description || '',
              appearance: existing.appearance || c.appearance || '',
              personality: existing.personality || c.personality || '',
            })
          }
        } else {
          // 新角色：创建
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
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {progress ? `正在分章扫描角色（${progress.current}/${progress.total}）...` : '正在从文本中提取角色...'}
                </span>
              </div>
              {progress && progress.total > 0 && (
                <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border-light)' }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                      backgroundColor: 'var(--color-accent)'
                    }}
                  />
                </div>
              )}
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
                共识别出 {extracted.length} 个角色（新增 {extracted.filter(c => !c.isExisting).length}，已有 {extracted.filter(c => c.isExisting).length}），勾选要保存的：
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
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{c.name}</div>
                      {c.isExisting ? (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
                          已有
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-dim)' }}>
                          新增
                        </span>
                      )}
                      {c.sources.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text-dim)' }}>
                          出现于 {c.sources.length} 章
                        </span>
                      )}
                    </div>
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
