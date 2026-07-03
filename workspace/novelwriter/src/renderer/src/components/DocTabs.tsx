import React from 'react'
import { X, Save } from 'lucide-react'
import { useLayoutStore, type OpenDoc } from '../store/layout'

interface DocTabsProps {
  onSave: (doc: OpenDoc) => void
  saving: boolean
}

export default function DocTabs({ onSave, saving }: DocTabsProps): JSX.Element {
  const openDocs = useLayoutStore((s) => s.openDocs)
  const activeDocId = useLayoutStore((s) => s.activeDocId)
  const setActiveDoc = useLayoutStore((s) => s.setActiveDoc)
  const closeDoc = useLayoutStore((s) => s.closeDoc)
  const activeDoc = openDocs.find((d) => d.id === activeDocId)

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    closeDoc(id)
  }

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeDoc && !saving) {
      onSave(activeDoc)
    }
  }

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto"
      style={{
        backgroundColor: 'var(--color-surface-alt)',
        borderBottom: '1px solid var(--color-border)'
      }}
    >
      {openDocs.map((doc) => {
        const isActive = doc.id === activeDocId
        return (
          <div
            key={doc.id}
            onClick={() => setActiveDoc(doc.id)}
            className="group flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer rounded-t-sm whitespace-nowrap transition-colors flex-shrink-0"
            style={{
              backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
              color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
              borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent'
            }}
          >
            <span className={doc.dirty ? 'font-medium' : ''}>
              {doc.title}
              {doc.dirty && <span style={{ color: 'var(--color-accent)' }}> •</span>}
            </span>
            <button
              onClick={(e) => handleClose(e, doc.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[var(--color-hover)]"
              style={{ color: 'var(--color-text-dim)' }}
              title="关闭"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}

      {openDocs.length > 0 && (
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleSaveClick}
            disabled={!activeDoc || saving}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{
              color: 'var(--color-accent)',
              opacity: saving ? 0.5 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
            title="保存文档"
          >
            <Save size={12} />
            <span>{saving ? '保存中...' : '保存'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
