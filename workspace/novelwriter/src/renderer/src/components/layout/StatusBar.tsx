import { BookOpen, FileText } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useAISettingsStore } from '../../store/aiSettings'

export default function StatusBar(): JSX.Element {
  const currentProject = useAppStore((s) => s.currentProject)
  const currentChapter = useAppStore((s) => s.currentChapter)
  const editorContent = useAppStore((s) => s.editorContent)

  const aiConfig = useAISettingsStore((s) => s.config)
  const modelLabel = aiConfig.model ? `${aiConfig.provider === 'ollama' ? '🖥' : '☁'} ${aiConfig.model}` : '未配置模型'

  return (
    <div
      className="no-select flex items-center justify-between"
      style={{
        height: 'var(--height-statusbar)',
        backgroundColor: 'var(--color-statusbar)',
        color: 'var(--color-statusbar-text)',
        fontSize: '0.7rem',
        flexShrink: 0,
        borderTop: '1px solid var(--color-border)',
      }}
    >
      {/* 左侧 */}
      <div className="flex items-center h-full">
        <StatusBarSegment>
          <BookOpen size={10} />
          <span className="font-medium brand-gradient">NovelWriter</span>
        </StatusBarSegment>
        {currentProject && (
          <>
            <StatusBarDivider />
            <StatusBarSegment title={currentProject.name}>
              <FileText size={10} />
              <span className="max-w-[120px] truncate">{currentProject.name}</span>
            </StatusBarSegment>
          </>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex items-center h-full">
        {currentChapter && (
          <StatusBarSegment title="当前章节字数">
            字数 {editorContent.length}
          </StatusBarSegment>
        )}
        {currentChapter?.updatedAt && (
          <>
            <StatusBarDivider />
            <StatusBarSegment title="最后保存时间">
              {new Date(currentChapter.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </StatusBarSegment>
          </>
        )}
        <StatusBarDivider />
        <StatusBarSegment
          title="点击配置 AI 模型"
          onClick={() => useAISettingsStore.getState().setShowSettings(true)}
        >
          <StatusBarDivider />
          <span>{modelLabel}</span>
        </StatusBarSegment>
      </div>
    </div>
  )
}

function StatusBarSegment({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }): JSX.Element {
  return (
    <div
      className="flex items-center gap-1 px-2 h-full"
      title={title}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </div>
  )
}

function StatusBarDivider(): JSX.Element {
  return <span className="mx-0.5" style={{ opacity: 0.25 }}>|</span>
}
