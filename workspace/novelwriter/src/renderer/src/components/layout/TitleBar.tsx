import { Sun, Moon, Settings } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useAISettingsStore } from '../../store/aiSettings'
import { useThemeStore } from '../../store/theme'

const isMac = navigator.userAgent.includes('Mac')

export default function TitleBar(): JSX.Element {
  const currentProject = useAppStore((s) => s.currentProject)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  return (
    <div
      className="no-select flex items-center"
      style={{
        height: 'var(--height-titlebar)',
        backgroundColor: 'var(--color-titlebar)',
        borderBottom: '1px solid var(--color-border)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* 左侧：macOS 交通灯留空 + 应用名 */}
      <div className="flex items-center flex-shrink-0" style={{ paddingLeft: isMac ? 78 : 12 }}>
        <span className="text-xs font-semibold tracking-wider brand-gradient">
          NovelWriter
        </span>
        {currentProject && (
          <span className="text-xs ml-2 opacity-50" style={{ color: 'var(--color-titlebar-text)' }}>
            — {currentProject.name}
          </span>
        )}
      </div>

      {/* 中间弹性拖拽区 */}
      <div className="flex-1" />

      {/* 右侧控件 */}
      <div
        className="flex items-center gap-0.5 pr-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}
          className="icon-btn"
          style={{ width: 24, height: 22 }}
        >
          {theme === 'dark' ? <Sun size={13} strokeWidth={1.5} /> : <Moon size={13} strokeWidth={1.5} />}
        </button>

        {/* 设置 */}
        <button
          onClick={() => useAISettingsStore.getState().setShowSettings(true)}
          title="设置"
          className="icon-btn"
          style={{ width: 24, height: 22 }}
        >
          <Settings size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
