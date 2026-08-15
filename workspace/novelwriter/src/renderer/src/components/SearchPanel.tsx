import React, { useState } from 'react'
import { Search as SearchIcon, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/app'
import { useLayoutStore } from '../store/layout'

interface SearchHit {
  docId: string
  kind: string
  title: string
  snippet: string
  chapterOrder: number
}

const KIND_FILTERS = ['全部', '章节', '角色', '世界观', '地点', '时间线', '角色关系', '灵感', '参考资料', '写作日志', '根目录']

export default function SearchPanel(): JSX.Element {
  const currentProject = useAppStore((s) => s.currentProject)
  const chapters = useAppStore((s) => s.chapters)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('全部')
  const [results, setResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [status, setStatus] = useState('')

  const doSearch = async (): Promise<void> => {
    if (!currentProject || !query.trim()) return
    setSearching(true)
    setStatus('')
    try {
      const hits = await window.api.searchIndex(
        currentProject.id,
        query.trim(),
        kind === '全部' ? undefined : { kinds: [kind] }
      )
      setResults((hits as SearchHit[]) ?? [])
      setStatus(`找到 ${(hits as SearchHit[]).length} 条结果`)
    } catch (err) {
      setStatus('搜索失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSearching(false)
    }
  }

  const handleRebuild = async (): Promise<void> => {
    if (!currentProject) return
    setRebuilding(true)
    setStatus('正在重建索引…')
    try {
      const result = await window.api.rebuildIndex(currentProject.id)
      const count = (result as { count?: number } | undefined)?.count ?? 0
      setStatus(`索引已重建：${count} 个文档`)
      if (query.trim()) await doSearch()
    } catch (err) {
      setStatus('重建失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRebuilding(false)
    }
  }

  const openHit = (hit: SearchHit): void => {
    if (hit.kind !== '章节') return
    const ch = chapters.find(c => c.sortOrder === hit.chapterOrder - 1)
    if (!ch) return
    useLayoutStore.getState().openDoc({
      id: `chapter:${ch.id}`,
      type: 'chapter',
      title: ch.title,
      entityId: ch.id,
      content: '',
      dirty: false
    })
  }

  return (
    <div className="w-full h-full p-4 flex flex-col" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="flex items-center gap-2 mb-3">
        <SearchIcon size={16} style={{ color: 'var(--color-text-dim)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void doSearch() }}
          placeholder="全书搜索：正文 / 章纲 / 角色 / 世界观…"
          className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
          style={{ backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-2 py-1.5 rounded text-xs outline-none"
          style={{ backgroundColor: 'var(--color-sidebar)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
        >
          {KIND_FILTERS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <button
          onClick={() => void doSearch()}
          disabled={searching || !query.trim()}
          className="px-3 py-1.5 rounded text-xs"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: searching ? 'not-allowed' : 'pointer' }}
        >
          {searching ? '搜索中…' : '搜索'}
        </button>
        <button
          onClick={() => void handleRebuild()}
          disabled={rebuilding}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
          style={{ backgroundColor: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', cursor: rebuilding ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={12} className={rebuilding ? 'animate-spin' : ''} />
          {rebuilding ? '重建中…' : '重建索引'}
        </button>
      </div>

      {status && (
        <div className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>{status}</div>
      )}

      <div className="flex-1 overflow-auto space-y-2">
        {results.map(hit => (
          <button
            key={hit.docId}
            onClick={() => openHit(hit)}
            className="block w-full text-left px-3 py-2 rounded"
            style={{ backgroundColor: 'var(--color-sidebar)', border: '1px solid var(--color-border-light)', cursor: hit.kind === '章节' ? 'pointer' : 'default' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-accent)' }}>{hit.kind}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{hit.title}</span>
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{hit.snippet}</div>
          </button>
        ))}
        {!searching && query.trim() && results.length === 0 && (
          <div className="text-sm py-8 text-center" style={{ color: 'var(--color-text-dim)' }}>没有匹配的结果</div>
        )}
      </div>
    </div>
  )
}
