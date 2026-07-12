import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '../store/app'
import ModelSelector from './ModelSelector'

interface AIGenerateDialogProps {
  title: string
  chapterTitle: string
  onClose: () => void
  onStart: () => Promise<void>
}

function AIGenerateDialog({ title, chapterTitle, onClose, onStart }: AIGenerateDialogProps): JSX.Element {
  const chatModel = useAppStore((s) => s.chatModel)
  const chatProviderId = useAppStore((s) => s.chatProviderId)
  const chatReasoningEffort = useAppStore((s) => s.chatReasoningEffort)
  const setChatModel = useAppStore((s) => s.setChatModel)
  const setChatProviderId = useAppStore((s) => s.setChatProviderId)
  const setChatReasoningEffort = useAppStore((s) => s.setChatReasoningEffort)

  const [status, setStatus] = useState<'ready' | 'generating' | 'done' | 'error'>('ready')
  const [log, setLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [showEffortDropdown, setShowEffortDropdown] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  const handleStart = async (): Promise<void> => {
    setStatus('generating')
    setLog((prev) => [...prev, `⏳ 开始生成「${chapterTitle}」...`])
    try {
      await onStart()
      setLog((prev) => [...prev, '✅ 生成完成！'])
      setStatus('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setLog((prev) => [...prev, `❌ 生成失败: ${msg}`])
      setErrorMsg(msg)
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-[560px] rounded-xl shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>章节：{chapterTitle}</span>
          <div className="flex-1" />
          <ModelSelector
            providerId={chatProviderId}
            model={chatModel}
            onChange={(pid, m) => { setChatProviderId(pid); setChatModel(m) }}
            disabled={status === 'generating'}
            minWidth={140}
          />
          <div className="relative">
            <button onClick={() => setShowEffortDropdown(!showEffortDropdown)} disabled={status === 'generating'}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <span>{chatReasoningEffort === 'low' ? '低' : chatReasoningEffort === 'medium' ? '中' : chatReasoningEffort === 'high' ? '高' : '最高'}</span>
              <ChevronDown size={10} />
            </button>
            {showEffortDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                {(['low', 'medium', 'high', 'max'] as const).map(e => (
                  <button key={e} onClick={() => { setChatReasoningEffort(e); setShowEffortDropdown(false) }}
                    className="w-full px-3 py-1.5 text-left text-xs"
                    style={{ color: chatReasoningEffort === e ? 'var(--color-accent)' : 'var(--color-text)' }}>
                    {e === 'low' ? '低' : e === 'medium' ? '中' : e === 'high' ? '高' : '最高(max)'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 进度日志 */}
        <div className="flex-1 overflow-auto p-5">
          <div className="rounded-lg p-3 font-mono text-xs leading-relaxed" style={{ backgroundColor: 'var(--color-sidebar)', minHeight: 120, maxHeight: 300, overflow: 'auto' }}>
            {log.length === 0 && status === 'ready' && (
              <span style={{ color: 'var(--color-text-dim)' }}>准备好生成，点击下方按钮开始...</span>
            )}
            {log.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('❌') ? 'var(--color-danger)' : line.startsWith('✅') ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--color-border)' }}>
          {(status === 'done' || status === 'error') && (
            <button onClick={onClose}
              className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {status === 'done' ? '完成' : '关闭'}
            </button>
          )}
          {status === 'generating' && (
            <button disabled className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-dim)', border: 'none', cursor: 'not-allowed' }}>
              生成中...
            </button>
          )}
          {status === 'ready' && (
            <>
              <button onClick={onClose}
                className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={handleStart}
                className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                开始生成
              </button>
            </>
          )}
          {status === 'error' && (
            <button onClick={handleStart}
              className="rounded px-4 py-1.5 text-xs" style={{ backgroundColor: '#f97316', color: '#fff', border: 'none', cursor: 'pointer' }}>
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIGenerateDialog
