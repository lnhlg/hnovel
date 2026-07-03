import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'

interface AIAssetBarProps {
  show: boolean
  onToggle: () => void
  hint: string
  onHintChange: (v: string) => void
  batchCount: number
  onBatchCountChange: (v: number) => void
  loading: boolean
  onGenerateOne: () => void
  onGenerateBatch: () => void
  oneLabel?: string
  batchLabel?: string
  hideBatch?: boolean
}

/**
 * 共享的 AI 生成栏：可隐藏展开，包含提示输入、单个生成和批量生成
 */
export default function AIAssetBar({
  show,
  onToggle,
  hint,
  onHintChange,
  batchCount,
  onBatchCountChange,
  loading,
  onGenerateOne,
  onGenerateBatch,
  oneLabel = '生成 1 个',
  batchLabel = '批量',
  hideBatch = false
}: AIAssetBarProps): JSX.Element {
  return (
    <>
      {show && (
        <div className="px-3 py-2 space-y-1.5" style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <textarea
            value={hint}
            onChange={(e) => onHintChange(e.target.value)}
            className="textarea w-full text-xs"
            rows={2}
            placeholder="提示（可选）：描述你想要的..."
          />
          <div className="flex gap-1">
            <button onClick={onGenerateOne} disabled={loading} className="btn btn-primary text-xs py-1 flex-1">
              {loading ? '生成中...' : oneLabel}
            </button>
            {!hideBatch && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={batchCount}
                  onChange={(e) => onBatchCountChange(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="input text-xs w-10 py-1"
                  title="批量数量"
                />
                <button onClick={onGenerateBatch} disabled={loading} className="btn btn-ghost text-xs py-1" style={{ color: 'var(--color-accent)' }}>
                  {batchLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

interface AIToggleButtonProps {
  active: boolean
  onClick: () => void
  title?: string
}

/**
 * 切换 AI 工具栏的按钮
 */
export function AIToggleButton({ active, onClick, title }: AIToggleButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors"
      style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', backgroundColor: active ? 'var(--color-accent-light)' : 'transparent' }}
      title={title}
    >
      <Sparkles size={12} />
      <span>AI</span>
    </button>
  )
}
