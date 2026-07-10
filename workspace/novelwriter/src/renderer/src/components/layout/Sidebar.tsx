import React, { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, X, Sparkles, ChevronRight, ChevronDown, ScrollText, Users, Globe, Clock, MapPin, Link2, Lightbulb, FileText, BookOpen, FolderOpen, UserPlus } from 'lucide-react'
import { useAppStore } from '../../store/app'
import { useLayoutStore, type SidebarView, type DocType } from '../../store/layout'
import NewProjectDialog from '../dialogs/NewProjectDialog'
import AIWizardDialog from '../dialogs/AIWizardDialog'
import ExtractCharactersDialog from '../dialogs/ExtractCharactersDialog'

interface CategoryItem {
  id: SidebarView
  label: string
  icon: React.ElementType
  count: number
}

export default function Sidebar(): JSX.Element {
  const {
    projects,
    currentProject,
    chapters,
    currentChapter,
    characters,
    worldSettings,
    timelines,
    locations,
    characterRelations,
    inspirations,
    writingLogs,
    references,
    writingStyles,
    loadProjects,
    setCurrentProject,
    setCurrentChapter,
    loadChapters,
    loadCharacters,
    loadWorldSettings,
    loadTimelines,
    loadLocations,
    loadCharacterRelations,
    loadInspirations,
    loadWritingLogs,
    loadReferences,
    loadWritingStyles,
    loadSkills,
    loadItems,
    loadDialogues,
    createChapter,
    deleteProject,
    deleteChapter
  } = useAppStore()

  const sidebarView = useLayoutStore((s) => s.sidebarView)
  const setSidebarView = useLayoutStore((s) => s.setSidebarView)
  const openDoc = useLayoutStore((s) => s.openDoc)
  const openDocs = useLayoutStore((s) => s.openDocs)
  const activeDocId = useLayoutStore((s) => s.activeDocId)

  const [showNewProject, setShowNewProject] = useState(false)
  const [showAIWizard, setShowAIWizard] = useState(false)
  const [showScanChars, setShowScanChars] = useState(false)
  const [scanText, setScanText] = useState('')
  const [scanChapterContents, setScanChapterContents] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chapterId: string } | null>(null)
  const [renameChapterId, setRenameChapterId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const openDocTab = (type: DocType, entityId: string, title: string): void => {
    openDoc({
      id: `${type}:${entityId}`,
      type,
      title,
      entityId,
      content: '',
      dirty: false
    })
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  React.useEffect(() => {
    loadProjects()
    loadWritingStyles()
    loadSkills()
  }, [])

  const handleSelectProject = async (project: typeof currentProject): Promise<void> => {
    if (!project) return
    setCurrentProject(project)
    await loadChapters(project.id)
    await loadCharacters(project.id)
    await loadWorldSettings(project.id)
    await loadTimelines(project.id)
    await loadLocations(project.id)
    await loadItems(project.id)
    await loadDialogues(project.id)
    await loadCharacterRelations(project.id)
    await loadInspirations(project.id)
    await loadWritingLogs(project.id)
    await loadReferences(project.id)
    openDocTab('project', project.id, project.name || '项目信息')
  }

  const handleCreateProject = async (name: string, folderPath: string, synopsis: string): Promise<void> => {
    const project = await window.api.createProjectWithPath(name, folderPath)
    if (synopsis) {
      await window.api.saveProjectSynopsis(project.id, synopsis)
    }
    await loadProjects()
  }

  const handleCreateChapter = async (): Promise<void> => {
    if (!currentProject) return
    await createChapter(currentProject.id)
  }

  const handleDeleteProject = async (): Promise<void> => {
    if (!currentProject) return
    if (!confirm(`确定要删除项目「${currentProject.name}」吗？`)) return
    await deleteProject(currentProject.id)
  }

  const handleDeleteChapter = async (id: string): Promise<void> => {
    if (!confirm('确定要删除这个章节吗？')) return
    await deleteChapter(id)
  }

  const handleContextMenu = (e: React.MouseEvent, chapterId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, chapterId })
  }

  const handleStartRename = () => {
    if (!contextMenu) return
    const ch = chapters.find(c => c.id === contextMenu.chapterId)
    if (!ch) return
    setRenameChapterId(contextMenu.chapterId)
    setRenameTitle(ch.title)
    setContextMenu(null)
  }

  const handleRenameConfirm = async () => {
    if (!renameChapterId || !renameTitle.trim()) {
      setRenameChapterId(null)
      return
    }
    const ch = chapters.find(c => c.id === renameChapterId)
    if (!ch) return
    await window.api.saveChapter({
      id: ch.id,
      projectId: ch.projectId,
      title: renameTitle.trim()
    })
    await loadChapters(ch.projectId)
    setRenameChapterId(null)
  }

  // 点击其他地方关闭右键菜单
  useEffect(() => {
    const close = () => setContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', close)
      return () => window.removeEventListener('click', close)
    }
  }, [contextMenu])

  useEffect(() => {
    if (renameChapterId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renameChapterId])

  const handleProjectCreated = async (projectId: string): Promise<void> => {
    await loadProjects()
    const { projects: updatedProjects } = useAppStore.getState()
    const project = updatedProjects.find(p => p.id === projectId)
    if (project) {
      await handleSelectProject(project)
    }
  }

  const handleSelectCategory = (view: SidebarView) => {
    setSidebarView(view)
    if (!currentProject) return
    if (view === 'characters') {
      openDocTab('characters', 'characters', '角色设定')
    } else if (view === 'world') {
      openDocTab('worldSettings', 'world', '世界观设定')
    } else if (view === 'timeline') {
      openDocTab('timeline', 'timeline', '时间线')
    } else if (view === 'locations') {
      openDocTab('locations', 'locations', '地点场景')
    } else if (view === 'relations') {
      openDocTab('characterRelations', 'relations', '角色关系')
    } else if (view === 'inspirations') {
      openDocTab('inspirations', 'inspirations', '灵感记录')
    } else if (view === 'references') {
      openDocTab('references', 'references', '参考资料')
    } else if (view === 'logs') {
      openDocTab('writingLogs', 'writingLogs', '写作日志')
    } else if (view === 'writingStyles') {
      openDocTab('writingStyles', 'writingStyles', '写作风格')
    }
  }

  const handleSelectChapter = (ch: typeof currentChapter) => {
    setCurrentChapter(ch)
    setSidebarView('outline')
    openDocTab('chapter', ch.id, ch.title)
  }

  const categories: CategoryItem[] = currentProject ? [
    { id: 'characters', label: '角色', icon: Users, count: characters.length },
    { id: 'world', label: '世界观', icon: Globe, count: worldSettings.length },
    { id: 'timeline', label: '时间线', icon: Clock, count: timelines.length },
    { id: 'locations', label: '地点场景', icon: MapPin, count: locations.length },
    { id: 'relations', label: '角色关系', icon: Link2, count: characterRelations.length },
    { id: 'inspirations', label: '灵感记录', icon: Lightbulb, count: inspirations.length },
    { id: 'logs', label: '写作日志', icon: FileText, count: writingLogs.length },
    { id: 'references', label: '参考资料', icon: BookOpen, count: references.length },
  ] : []

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-sidebar)' }}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          项目
        </span>
      </div>

      {/* 操作区 */}
      <div className="px-2 pt-2 pb-1 space-y-1">
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Plus size={14} />
          <span>新建项目</span>
        </button>
        <button
          onClick={async () => {
            const result = await window.api.selectFolder()
            if (!result || result.canceled || !result.filePaths?.[0]) return
            try {
              const project = await window.api.openProjectFromFolder(result.filePaths[0])
              await loadProjects()
              await handleSelectProject(project)
            } catch (err) {
              alert('打开项目失败：' + (err instanceof Error ? err.message : String(err)))
            }
          }}
          className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <FolderOpen size={14} />
          <span>打开项目</span>
        </button>
        <button
          onClick={() => setShowAIWizard(true)}
          className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
          style={{ color: 'var(--color-accent)' }}
        >
          <Sparkles size={14} />
          <span>AI 智能创建</span>
        </button>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        <div className="space-y-0.5">
          {projects.map((p) => {
            const isActive = currentProject?.id === p.id
            return (
              <div key={p.id}>
                {/* 项目节点 */}
                <div
                  onClick={() => handleSelectProject(p)}
                  className="group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isActive ? 'var(--color-active)' : 'transparent',
                    color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-hover)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  {isActive && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject() }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                      style={{ color: 'var(--color-danger)' }}
                      title="删除项目"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* 展开的项目内容树 */}
                {isActive && (
                  <div className="ml-1 mt-0.5 space-y-0.5">
                    {/* 章节分组 */}
                    <div>
                      <div
                        onClick={() => toggleSection('chapters')}
                        className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {expandedSections.has('chapters') ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <ScrollText size={12} />
                        <span className="flex-1">章节</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{chapters.length}</span>
                      </div>
                      {expandedSections.has('chapters') && (
                        <div className="ml-5 border-l-2" style={{ borderColor: 'var(--color-border-light)' }}>
                          {chapters.map((ch) => (
                            <div key={ch.id} className="group flex items-center">
                              <div
                                onClick={() => handleSelectChapter(ch)}
                                onContextMenu={(e) => handleContextMenu(e, ch.id)}
                                className="flex-1 flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors"
                                style={{
                                  backgroundColor: currentChapter?.id === ch.id ? 'var(--color-active)' : 'transparent',
                                  color: currentChapter?.id === ch.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                }}
                                onMouseEnter={e => { if (currentChapter?.id !== ch.id) e.currentTarget.style.backgroundColor = 'var(--color-hover)' }}
                                onMouseLeave={e => { if (currentChapter?.id !== ch.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                              >
                                {renameChapterId === ch.id ? (
                                  <input
                                    ref={renameInputRef}
                                    value={renameTitle}
                                    onChange={(e) => setRenameTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameConfirm()
                                      if (e.key === 'Escape') setRenameChapterId(null)
                                    }}
                                    onBlur={handleRenameConfirm}
                                    className="input text-xs w-full py-0.5 px-1"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="truncate">{ch.sortOrder + 1}. {ch.title.replace(/^(?:第\s*[零一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟\d]+\s*[章回节部]\s*[·•.、．：:\s-]*|\d+\.[\s-]*|[Cc]hapter\s+\d+[\s-:]*)+/, '').trim()}</span>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteChapter(ch.id) }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 mr-1"
                                style={{ color: 'var(--color-text-dim)' }}
                                title="删除章节"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          {chapters.length === 0 && (
                            <div className="px-2 py-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>
                              暂无章节
                            </div>
                          )}
                          <button
                            onClick={handleCreateChapter}
                            className="flex items-center gap-1 px-2 py-1 text-xs w-full rounded-sm transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Plus size={12} />
                            <span>新建章节</span>
                          </button>
                          <button
                            onClick={async () => {
                              if (!currentProject) return
                              // 收集所有章节正文（不再截断，由对话框分章扫描）
                              const contents = chapters.map(c => c.content).filter(Boolean)
                              if (contents.length === 0) { alert('章节内容为空，无法扫描'); return }
                              setScanText(contents.join('\n\n'))
                              setScanChapterContents(contents)
                              setShowScanChars(true)
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs w-full rounded-sm transition-colors"
                            style={{ color: 'var(--color-text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <UserPlus size={12} />
                            <span>扫描角色</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 其他分类节点——可展开子项 */}
                    {(() => {
                      const expandableCats: Array<{
                        id: string; label: string; icon: React.ElementType; items: Array<{id: string; title: string; subtitle?: string}>; docType: DocType; panelType: DocType; panelId: string
                      }> = [
                        { id: 'characters', label: '角色', icon: Users, docType: 'character', panelType: 'characters', panelId: 'characters', items: characters.map(c => ({ id: c.id, title: c.name, subtitle: c.role })) },
                        { id: 'world', label: '世界观', icon: Globe, docType: 'worldSetting', panelType: 'worldSettings', panelId: 'world', items: worldSettings.map(w => ({ id: w.id, title: w.key, subtitle: w.category })) },
                        { id: 'timeline', label: '时间线', icon: Clock, docType: 'timeline', panelType: 'timeline', panelId: 'timeline', items: timelines.map(t => ({ id: t.id, title: t.title })) },
                        { id: 'locations', label: '地点场景', icon: MapPin, docType: 'location', panelType: 'locations', panelId: 'locations', items: locations.map(l => ({ id: l.id, title: l.name, subtitle: l.type })) },
                        { id: 'inspirations', label: '灵感记录', icon: Lightbulb, docType: 'inspirations', panelType: 'inspirations', panelId: 'inspirations', items: inspirations.map(i => ({ id: i.id, title: i.title })) },
                        { id: 'references', label: '参考资料', icon: BookOpen, docType: 'references', panelType: 'references', panelId: 'references', items: references.map(r => ({ id: r.id, title: r.title })) },
                        { id: 'logs', label: '写作日志', icon: FileText, docType: 'writingLogs', panelType: 'writingLogs', panelId: 'writingLogs', items: writingLogs.map(l => ({ id: l.id, title: '日志 #' + l.createdAt?.slice(0,10) })) },
                      ]
                      return expandableCats.map(cat => (
                        <div key={cat.id}>
                          <div className="flex items-center gap-1 px-2 py-1 text-xs rounded-sm transition-colors"
                            style={{ color: 'var(--color-text-secondary)' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span onClick={() => toggleSection(cat.id)} className="cursor-pointer flex items-center">
                              {expandedSections.has(cat.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                            <span onClick={() => { setSidebarView('project'); openDocTab(cat.panelType, cat.panelId, cat.label) }}
                              className="flex items-center gap-1 flex-1 cursor-pointer">
                              <cat.icon size={12} />
                              <span className="flex-1">{cat.label}</span>
                              <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{cat.items.length}</span>
                            </span>
                          </div>
                          {expandedSections.has(cat.id) && (
                            <div className="ml-5 border-l-2" style={{ borderColor: 'var(--color-border-light)' }}>
                              {cat.items.map(item => (
                                <div key={item.id}
                                  onClick={() => openDocTab(cat.docType, item.id, item.title)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <span className="truncate">{item.title}</span>
                                  {item.subtitle && <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>({item.subtitle})</span>}
                                </div>
                              ))}
                              {cat.items.length === 0 && (
                                <div className="px-2 py-1 text-xs" style={{ color: 'var(--color-text-dim)' }}>暂无{cat.label}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    })()}

                    {/* 角色关系（共用一张图，不展开） */}
                    <div
                      onClick={() => { setSidebarView('relations'); openDocTab('characterRelations', 'relations', '角色关系') }}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors"
                      style={{
                        color: sidebarView === 'relations' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        backgroundColor: sidebarView === 'relations' ? 'var(--color-active)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (sidebarView !== 'relations') e.currentTarget.style.backgroundColor = 'var(--color-hover)' }}
                      onMouseLeave={e => { if (sidebarView !== 'relations') e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <Link2 size={12} />
                      <span className="flex-1">角色关系</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{characterRelations.length}</span>
                    </div>

                    {/* 记忆图谱 */}
                    <div
                      onClick={() => openDocTab('memoryGraph', 'memoryGraph', '记忆图谱')}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer rounded-sm transition-colors"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Globe size={12} />
                      <span className="flex-1">记忆图谱</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                zIndex: 9999,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '4px 0',
                minWidth: '120px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <button
                onClick={handleStartRename}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                style={{ color: 'var(--color-text)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                重命名
              </button>
            </div>
          )}

          {projects.length === 0 && (
            <div className="px-2 py-4 text-xs text-center" style={{ color: 'var(--color-text-dim)' }}>
              暂无项目
            </div>
          )}
        </div>
      </div>

      {/* 新建项目对话框 */}
      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        onConfirm={handleCreateProject}
      />

      {/* 扫描角色对话框 */}
      {currentProject && (
        <ExtractCharactersDialog
          open={showScanChars}
          onClose={() => setShowScanChars(false)}
          sourceText={scanText}
          chapterContents={scanChapterContents}
          projectId={currentProject.id}
        />
      )}

      {/* AI 智能创建对话框 */}
      <AIWizardDialog
        open={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  )
}
