import { FolderOpen, Users, ScrollText, Globe, Clock, MapPin, Link2, Lightbulb, FileText, BookOpen } from 'lucide-react'
import { useLayoutStore, type SidebarView } from '../../store/layout'

const activities: Array<{ id: SidebarView; icon: typeof FolderOpen; label: string }> = [
  { id: 'project', icon: FolderOpen, label: '项目结构' },
  { id: 'characters', icon: Users, label: '角色管理' },
  { id: 'outline', icon: ScrollText, label: '大纲规划' },
  { id: 'world', icon: Globe, label: '世界观' },
  { id: 'timeline', icon: Clock, label: '时间线' },
  { id: 'locations', icon: MapPin, label: '地点场景' },
  { id: 'relations', icon: Link2, label: '角色关系' },
  { id: 'inspirations', icon: Lightbulb, label: '灵感记录' },
  { id: 'logs', icon: FileText, label: '写作日志' },
  { id: 'references', icon: BookOpen, label: '参考资料' },
]

export default function ActivityBar(): JSX.Element {
  const sidebarView = useLayoutStore((s) => s.sidebarView)
  const setSidebarView = useLayoutStore((s) => s.setSidebarView)

  const handleClick = (id: SidebarView): void => {
    setSidebarView(id)
  }

  return (
    <div
      className="no-select flex flex-col items-center justify-between h-full py-1"
      style={{
        width: 'var(--width-activitybar)',
        backgroundColor: 'var(--color-activity-bar)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* 顶部图标组 */}
      <div className="flex flex-col items-center gap-0.5 w-full">
        {activities.map(({ id, icon: Icon, label }) => {
          const isActive = sidebarView === id
          return (
            <button
              key={id}
              onClick={() => handleClick(id)}
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

      {/* 底部留空 */}
      <div />
    </div>
  )
}
