import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'

export default function WritingLogsPanel(): JSX.Element {
  const { currentProject, writingLogs, loadWritingLogs, addWritingLog, deleteWritingLog } = useAppStore()
  const [newLogContent, setNewLogContent] = useState('')

  useEffect(() => {
    if (currentProject) {
      loadWritingLogs(currentProject.id)
    }
  }, [currentProject?.id])

  const handleAdd = async () => {
    if (!currentProject || !newLogContent.trim()) return
    await addWritingLog(currentProject.id, newLogContent.trim())
    setNewLogContent('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条日志吗？')) return
    await deleteWritingLog(id)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!currentProject) {
    return <div className="p-4 text-sm" style={{ color: 'var(--color-text-dim)' }}>选择一个项目查看写作日志</div>
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)', borderLeft: '1px solid var(--color-border)' }}>
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          写作日志 ({writingLogs.length})
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {writingLogs.length > 0 ? (
          writingLogs.map(log => (
            <div key={log.id} className="group rounded-lg p-2.5" style={{ border: '1px solid var(--color-border-light)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{formatDate(log.createdAt)}</span>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  style={{ color: 'var(--color-danger)' }}
                >删除</button>
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{log.content}</p>
            </div>
          ))
        ) : (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无写作日志</p>
        )}
      </div>

      <div className="p-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <textarea
          value={newLogContent}
          onChange={(e) => setNewLogContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAdd())}
          className="textarea w-full text-xs"
          rows={2}
          placeholder="记录今天的写作心得、进度或想法..."
        />
        <div className="mt-1 flex justify-end">
          <button onClick={handleAdd} disabled={!newLogContent.trim()} className="btn btn-primary text-xs py-1">记录</button>
        </div>
      </div>
    </div>
  )
}
