import React, { useEffect, useRef, useState } from 'react'

interface AIGenerateDialogProps {
  title: string
  chapterTitle: string
  onClose: () => void
  onStart: () => Promise<void>
}

function AIGenerateDialog({ title, chapterTitle, onClose, onStart }: AIGenerateDialogProps): JSX.Element {
  const [status, setStatus] = useState<'ready' | 'generating' | 'done' | 'error'>('ready')
  const [log, setLog] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
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
      <div className="w-[520px] rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-gray-500">
          章节：{chapterTitle}
        </p>

        {/* 进度日志 */}
        <div className="mb-4 max-h-48 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs leading-relaxed">
          {log.length === 0 && status === 'ready' && (
            <span className="text-gray-400">准备好生成，点击下方按钮开始...</span>
          )}
          {log.map((line, i) => (
            <div key={i} className={line.startsWith('❌') ? 'text-red-500' : line.startsWith('✅') ? 'text-green-600' : 'text-gray-700'}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          {(status === 'done' || status === 'error') && (
            <button
              onClick={onClose}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600"
            >
              {status === 'done' ? '完成' : '关闭'}
            </button>
          )}
          {status === 'generating' && (
            <button
              disabled
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
            >
              生成中...
            </button>
          )}
          {status === 'ready' && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleStart}
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600"
              >
                开始生成
              </button>
            </>
          )}
          {status === 'error' && (
            <button
              onClick={handleStart}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600"
            >
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AIGenerateDialog
