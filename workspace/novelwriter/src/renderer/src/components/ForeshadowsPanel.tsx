import React, { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/app'

interface Foreshadow {
  id: string
  title: string
  status: 'planted' | 'active' | 'resolved'
  chapterId?: string
  marker?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

const STATUS_LABEL: Record<Foreshadow['status'], string> = {
  planted: '已埋设',
  active: '活跃',
  resolved: '已回收'
}

const NEXT_STATUS: Record<Foreshadow['status'], Foreshadow['status']> = {
  planted: 'active',
  active: 'resolved',
  resolved: 'planted'
}

export default function ForeshadowsPanel(): JSX.Element {
  const currentProject = useAppStore((s) => s.currentProject)
  const [list, setList] = useState<Foreshadow[]>([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Foreshadow['status']>('planted')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (): Promise<void> => {
    if (!currentProject) { setList([]); return }
    try {
      const data = await window.api.listForeshadows(currentProject.id)
      setList((data as Foreshadow[]) ?? [])
    } catch (err) {
      setError('加载失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }, [currentProject])

  useEffect(() => { void load() }, [load])

  const handleAdd = async (): Promise<void> => {
    if (!currentProject || !title.trim()) return
    setLoading(true)
    setError('')
    try {
      await window.api.saveForeshadow(currentProject.id, {
        title: title.trim(),
        status,
        notes: notes.trim() || undefined
      })
      setTitle('')
      setNotes('')
      await load()
    } catch (err) {
      setError('保存失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const handleAdvance = async (f: Foreshadow): Promise<void> => {
    if (!currentProject) return
    await window.api.saveForeshadow(currentProject.id, {
      id: f.id,
      title: f.title,
      status: NEXT_STATUS[f.status],
      chapterId: f.chapterId,
      marker: f.marker,
      notes: f.notes,
      createdAt: f.createdAt
    })
    await load()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!currentProject || !confirm('确定删除这条伏笔线？')) return
    await window.api.deleteForeshadow(currentProject.id, id)
    await load()
  }

  return (
    <div className="w-full h-full p-4 flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>伏笔线追踪</div>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="伏笔线名称，如：假山密道"
          className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
          style={{ backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Foreshadow['status'])}
          className="px-2 py-1.5 rounded text-xs outline-none"
          style={{ backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        >
          <option value="planted">已埋设</option>
          <option value="active">活跃</option>
          <option value="resolved">已回收</option>
        </select>
        <button
          onClick={() => void handleAdd()}
          disabled={loading || !title.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <Plus size={12} /> 添加
        </button>
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="备注（可选）：这条伏笔线在哪里、回收条件…"
        className="px-3 py-1.5 rounded text-xs outline-none mb-3"
        style={{ backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
      />

      {error && <div className="text-xs mb-2" style={{ color: 'var(--color-danger)' }}>{error}</div>}

      <div className="flex-1 overflow-auto space-y-2">
        {list.map(f => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border-light)' }}>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap"
              style={{
                backgroundColor: f.status === 'resolved' ? 'var(--color-hover)' : 'var(--color-accent)',
                color: f.status === 'resolved' ? 'var(--color-text-dim)' : '#fff'
              }}
            >
              {STATUS_LABEL[f.status]}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{f.title}</span>
            {f.notes && (
              <span className="text-xs truncate" style={{ color: 'var(--color-text-dim)' }}>{f.notes}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => void handleAdvance(f)}
              title="推进状态：已埋设 → 活跃 → 已回收"
              className="flex items-center gap-0.5 text-xs"
              style={{ color: 'var(--color-accent)', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <ChevronRight size={12} /> {STATUS_LABEL[NEXT_STATUS[f.status]]}
            </button>
            <button
              onClick={() => void handleDelete(f.id)}
              title="删除"
              className="flex items-center justify-center"
              style={{ color: 'var(--color-danger)', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-dim)' }}>还没有伏笔线，添加一条开始追踪吧</div>
        )}
      </div>
    </div>
  )
}
