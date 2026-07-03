import { PenTool } from 'lucide-react'
import { useLayoutStore } from '../../store/layout'

const tools = [
  { id: 'writingStyles' as const, icon: PenTool, label: '写作风格' },
]

export default function RightToolbar(): JSX.Element {
  const sidebarView = useLayoutStore((s) => s.sidebarView)
  const setSidebarView = useLayoutStore((s) => s.setSidebarView)

  return (
    <div
      className="no-select flex flex-col items-center py-1"
      style={{
        width: 'var(--width-activitybar)',
        backgroundColor: 'var(--color-activity-bar)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {tools.map(({ id, icon: Icon, label }) => {
        const isActive = sidebarView === id
        return (
          <button
            key={id}
            onClick={() => setSidebarView(isActive ? 'project' : id)}
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
