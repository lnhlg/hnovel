import React, { useEffect, useRef, useState } from 'react'
import { useLayoutStore, type OpenDoc } from '../store/layout'
import { useAppStore } from '../store/app'

interface MarkdownDocEditorProps {
  doc: OpenDoc
}

export default function MarkdownDocEditor({ doc }: MarkdownDocEditorProps): JSX.Element {
  const setDocContent = useLayoutStore((s) => s.setDocContent)
  const setDocDirty = useLayoutStore((s) => s.setDocDirty)
  const setDocTitle = useLayoutStore((s) => s.setDocTitle)
  const currentProject = useAppStore((s) => s.currentProject)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef<string>('')

  useEffect(() => {
    if (loadedRef.current === doc.id) return
    loadedRef.current = doc.id

    if (doc.content) {
      return
    }

    const loadContent = async (): Promise<void> => {
      if (!currentProject) return
      setLoading(true)
      try {
        const content = await window.api.readDoc?.(currentProject.id, doc.type, doc.entityId)
        if (content != null) {
          setDocContent(doc.id, content)
          setDocDirty(doc.id, false)
        }
      } catch (err) {
        console.error('加载文档内容失败:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [doc.id, doc.type, doc.entityId, doc.content, currentProject, setDocContent, setDocDirty])

  useEffect(() => {
    if (textareaRef.current && doc.content && textareaRef.current.value !== doc.content) {
      textareaRef.current.value = doc.content
    }
  }, [doc.id])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newContent = e.target.value
    setDocContent(doc.id, newContent)

    const firstLine = newContent.split('\n')[0]
    const titleMatch = firstLine.match(/^#\s+(.+)/)
    if (titleMatch && titleMatch[1].trim() !== doc.title) {
      setDocTitle(doc.id, titleMatch[1].trim())
    }
  }

  if (loading && !doc.content) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>
          加载中...
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <textarea
        ref={textareaRef}
        defaultValue={doc.content}
        onChange={handleChange}
        className="flex-1 w-full resize-none border-none bg-transparent text-base leading-relaxed outline-none p-6"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.7'
        }}
        placeholder="开始编辑 Markdown 文档..."
        spellCheck={false}
      />
    </div>
  )
}
