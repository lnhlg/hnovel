import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, RefreshCw, Search } from 'lucide-react'

export interface AllModelItem {
  providerId: string
  providerName: string
  modelId: string
  modelName: string
}

interface ModelSelectorProps {
  /** 当前选中的供应商 ID（受控） */
  providerId: string
  /** 当前选中的模型 ID（受控） */
  model: string
  /** 选择变化回调，同时返回 providerId 和 modelId */
  onChange: (providerId: string, modelId: string) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 最小宽度 */
  minWidth?: number
  /** 占位文字 */
  placeholder?: string
}

/**
 * 跨供应商的模型选择器。
 * 调用 window.api.listAllModels() 一次性拉取所有供应商的所有模型，
 * 按供应商分组显示，选中后通过 onChange 同时返回 providerId 和 modelId。
 */
export default function ModelSelector({
  providerId,
  model,
  onChange,
  disabled,
  minWidth = 120,
  placeholder = '选择模型'
}: ModelSelectorProps): JSX.Element {
  const [allModels, setAllModels] = useState<AllModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const loadAll = async (): Promise<void> => {
    setLoading(true)
    try {
      const list = (await window.api.listAllModels?.()) ?? []
      setAllModels(list as AllModelItem[])
    } catch (err) {
      console.error('加载模型列表失败:', err)
      setAllModels([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // 打开时聚焦搜索框；关闭时清空搜索词
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0)
    } else {
      setQuery('')
    }
  }, [open])

  // 按搜索关键字过滤后，再按供应商分组
  const { grouped, providerNames, totalMatches } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? allModels.filter(m =>
          m.modelName.toLowerCase().includes(q) ||
          m.modelId.toLowerCase().includes(q) ||
          m.providerName.toLowerCase().includes(q)
        )
      : allModels
    const g = filtered.reduce<Record<string, AllModelItem[]>>((acc, m) => {
      if (!acc[m.providerName]) acc[m.providerName] = []
      acc[m.providerName].push(m)
      return acc
    }, {})
    return { grouped: g, providerNames: Object.keys(g), totalMatches: filtered.length }
  }, [allModels, query])

  // 显示文本：优先用选中模型的 modelName；找不到则用 modelId
  const selected = allModels.find(m => m.providerId === providerId && m.modelId === model)
  const displayText = selected ? `${selected.modelName}` : (model || placeholder)

  return (
    <div className="relative" ref={wrapRef} style={{ minWidth }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled || loading}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors w-full"
        style={{
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-secondary)',
          minWidth
        }}
      >
        {loading ? (
          <RefreshCw size={10} className="animate-spin" />
        ) : (
          <>
            <span className="truncate flex-1 text-left">{displayText}</span>
            <ChevronDown size={10} />
          </>
        )}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            maxHeight: 360,
            minWidth: Math.max(minWidth, 240)
          }}
        >
          {/* 搜索框 */}
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 border-b sticky top-0"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <Search size={11} style={{ color: 'var(--color-text-dim)' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索模型/供应商..."
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: 'var(--color-text)' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs hover:opacity-70"
                style={{ color: 'var(--color-text-dim)' }}
                title="清空"
              >
                ✕
              </button>
            )}
          </div>

          {/* 模型列表 */}
          <div className="overflow-auto flex-1">
            {providerNames.length > 0 ? (
              <div className="py-1">
                {providerNames.map(pName => (
                  <div key={pName}>
                    <div
                      className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-text-dim)', backgroundColor: 'var(--color-bg)' }}
                    >
                      {pName}
                    </div>
                    {grouped[pName].map(m => {
                      const isSel = m.providerId === providerId && m.modelId === model
                      return (
                        <button
                          key={`${m.providerId}:${m.modelId}`}
                          type="button"
                          onClick={() => { onChange(m.providerId, m.modelId); setOpen(false) }}
                          className="w-full px-3 py-1.5 text-left text-xs transition-colors"
                          style={{
                            color: isSel ? 'var(--color-accent)' : 'var(--color-text)',
                            backgroundColor: isSel ? 'var(--color-accent-light)' : 'transparent'
                          }}
                          onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'var(--color-hover)' }}
                          onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          {m.modelName || m.modelId}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-dim)' }}>
                {loading ? '加载中...' : query ? `无匹配模型（共 ${allModels.length} 个）` : '暂无可用模型'}
              </div>
            )}
          </div>

          {/* 底部：刷新 + 匹配数 */}
          <div
            className="px-3 py-1 text-xs border-t flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
          >
            <button
              type="button"
              onClick={() => { loadAll() }}
              className="flex items-center gap-1 hover:opacity-80"
            >
              <RefreshCw size={10} /> 刷新
            </button>
            {query && <span>匹配 {totalMatches} / {allModels.length}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
