import { PenTool, BookOpen } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'

const tools = [
  { id: 'writingStyles' as const, icon: PenTool, label: '写作风格', docType: 'writingStyles' as const, entityId: 'writingStyles' },
  { id: 'skills' as const, icon: BookOpen, label: '写作技能', docType: 'skills' as const, entityId: 'skills' },
]

export default function RightToolbar(): JSX.Element {
  const sidebarView = useLayoutStore((s) => s.sidebarView)
  const openDoc = useLayoutStore((s) => s.openDoc)

  const handleClick = (id: string, docType: string, entityId: string, label: string): void => {
    if (sidebarView === id) {
      return // already active, do nothing?
    }
    openDoc({
      id: `${docType}:${entityId}`,
      type: docType as any,
      title: label,
      entityId,
      content: '',
      dirty: false
    })
  }

  return (
    <div
      className="no-select flex flex-col items-center py-1"
      style={{
        width: 'var(--width-activitybar)',
        backgroundColor: 'var(--color-activity-bar)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {tools.map(({ id, icon: Icon, label, docType, entityId }) => {
        const isActive = sidebarView === id
        return (
          <button
            key={id}
            onClick={() => handleClick(id, docType, entityId, label)}
            title={label}
            className="relative flex items-center justify-center w-[36px] h-[36px] rounded-md transition-colors"
            style={{
              color: isActive
                ? 'var(--color-activity-icon-active)'
                : 'var(--color-activity-icon)',
            }}
          >
            {isActive && (
              <div
                className="absolute left-0 top-[8px] bottom-[8px] w-[2px] rounded-r"
                style={{ backgroundColor: 'var(--color-activity-indicator)' }}
              />
            )}
            <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
          </button>
        )
      })}
    </div>
  )
}
