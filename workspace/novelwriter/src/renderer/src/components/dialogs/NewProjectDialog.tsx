import React, { useState, useRef, useEffect } from 'react'
import { X, FolderOpen } from 'lucide-react'

interface NewProjectDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (name: string, folderPath: string, synopsis: string) => Promise<void>
}

export default function NewProjectDialog({ open, onClose, onConfirm }: NewProjectDialogProps): JSX.Element | null {
  const [name, setName] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setFolderPath('')
      setSynopsis('')
      setSaving(false)
      setPicking(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handlePickFolder = async (): Promise<void> => {
    setPicking(true)
    try {
      const result = await window.api.selectFolder()
      if (!result.canceled && result.filePaths.length > 0) {
        setFolderPath(result.filePaths[0])
      }
    } catch (error) {
      console.error('选择文件夹失败:', error)
      alert('无法打开文件夹选择对话框')
    } finally {
      setPicking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !folderPath.trim() || saving) return
    setSaving(true)
    try {
      await onConfirm(name.trim(), folderPath.trim(), synopsis.trim())
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && !saving) onClose()
  }

  if (!open) return null

  const isValid = name.trim() && folderPath.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="rounded-xl shadow-2xl w-[520px] overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>新建项目</h2>
          <button onClick={onClose} disabled={saving} className="icon-btn" style={{ width: 24, height: 24 }}>
            <X size={14} />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* 项目名称 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              项目名称 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的第一部小说"
              className="input w-full"
              disabled={saving}
              autoFocus
            />
          </div>

          {/* 选择文件夹 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              项目位置 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="选择一个文件夹存放项目数据..."
                className="input flex-1 text-xs"
                disabled={saving}
                readOnly
              />
              <button
                type="button"
                onClick={handlePickFolder}
                disabled={picking || saving}
                className="btn btn-ghost"
                style={{ flexShrink: 0 }}
              >
                <FolderOpen size={14} />
                <span>{picking ? '选择中...' : '浏览...'}</span>
              </button>
            </div>
          </div>

          {/* 小说大纲 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              小说大纲 <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>（可选）</span>
            </label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="大致的故事背景、主线、风格..."
              className="textarea w-full"
              rows={4}
              disabled={saving}
            />
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="btn btn-ghost">
              取消
            </button>
            <button type="submit" disabled={!isValid || saving} className="btn btn-primary">
              {saving ? '创建中...' : '创建项目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
