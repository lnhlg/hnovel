import React, { useEffect, useState } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { useAppStore } from './store/app'
import { useAISettingsStore } from './store/aiSettings'
import { useLayoutStore } from './store/layout'
import { useThemeStore } from './store/theme'
import AISettingsPanel from './components/AISettingsPanel'
import TipTapEditor from './components/TipTapEditor'
import OutlinePanel from './components/OutlinePanel'
import CharactersPanel from './components/CharactersPanel'
import WorldSettingsPanel from './components/WorldSettingsPanel'
import TimelinePanel from './components/TimelinePanel'
import LocationsPanel from './components/LocationsPanel'
import CharacterRelationsPanel from './components/CharacterRelationsPanel'
import InspirationsPanel from './components/InspirationsPanel'
import WritingLogsPanel from './components/WritingLogsPanel'
import ReferencesPanel from './components/ReferencesPanel'
import WritingStylesPanel from './components/WritingStylesPanel'
import SkillsPanel from './components/SkillsPanel'
import RightToolbar from './components/layout/RightToolbar'
import TitleBar from './components/layout/TitleBar'
import StatusBar from './components/layout/StatusBar'
import Sidebar from './components/layout/Sidebar'
import DocTabs from './components/DocTabs'
import MarkdownDocEditor from './components/MarkdownDocEditor'
import ChapterDocEditor from './components/ChapterDocEditor'
import CharacterRelationGraph from './components/CharacterRelationGraph'
import type { OpenDoc } from './store/layout'

function App(): JSX.Element {
  const {
    currentProject,
    editorContent,
    editorMode,
    setEditorContent,
    setEditorMode,
    saveCurrentChapter,
    loadProjects,
    loadChapters,
    loadCharacters,
    loadWorldSettings,
    loadTimelines,
    loadLocations,
    loadCharacterRelations,
    loadInspirations,
    loadWritingLogs,
    loadReferences,
    characters,
    characterRelations
  } = useAppStore()

  const { showSettings, setShowSettings } = useAISettingsStore()
  const sidebarView = useLayoutStore((s) => s.sidebarView)
  const openDocs = useLayoutStore((s) => s.openDocs)
  const activeDocId = useLayoutStore((s) => s.activeDocId)
  const setDocDirty = useLayoutStore((s) => s.setDocDirty)
  const setDocTitle = useLayoutStore((s) => s.setDocTitle)
  const setDocContent = useLayoutStore((s) => s.setDocContent)
  const closeAllDocs = useLayoutStore((s) => s.closeAllDocs)

  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const initTheme = useThemeStore((s) => s.initTheme)

  useEffect(() => {
    initTheme()
    loadProjects()
  }, [])

  useEffect(() => {
    if (!currentProject) {
      closeAllDocs()
    }
  }, [currentProject?.id])

  const handleSaveDoc = async (doc: OpenDoc): Promise<void> => {
    if (!currentProject || saving) return
    setSaving(true)
    try {
      const result = await window.api.saveDoc?.(currentProject.id, doc.type, doc.entityId, doc.content)
      if (result?.success) {
        setDocDirty(doc.id, false)
        // 从正文中提取标题，更新标签和侧栏
        if (doc.type === 'chapter') {
          const titleMatch = doc.content.match(/^#\s+(.+)/m)
          const extractedTitle = titleMatch?.[1]?.trim()
          if (extractedTitle && extractedTitle !== doc.title) {
            setDocTitle(doc.id, extractedTitle)
            // 即时同步到侧栏
            useAppStore.setState(state => ({
              chapters: state.chapters.map(c => c.id === doc.entityId ? { ...c, title: extractedTitle } : c)
            }))
          }
          console.log('[App] 文档保存成功:', extractedTitle || doc.title)
        } else {
          const newTitle = (result as Record<string,string>).newTitle || (result as Record<string,string>).newName
          if (newTitle && newTitle !== doc.title) {
            setDocTitle(doc.id, newTitle)
          }
          console.log('[App] 文档保存成功:', newTitle || doc.title)
        }
        if (doc.type === 'chapter') {
          await loadChapters(currentProject.id)
        } else if (doc.type === 'character' || doc.type === 'characters') {
          await loadCharacters(currentProject.id)
        } else if (doc.type === 'worldSetting' || doc.type === 'worldSettings') {
          await loadWorldSettings(currentProject.id)
        } else if (doc.type === 'location' || doc.type === 'locations') {
          await loadLocations(currentProject.id)
        } else if (doc.type === 'project') {
          // 项目信息变了，刷新项目列表
          await loadProjects()
        } else if (doc.type === 'timeline') {
          await loadTimelines(currentProject.id)
        } else if (doc.type === 'characterRelations') {
          await loadCharacterRelations(currentProject.id)
        } else if (doc.type === 'inspirations') {
          await loadInspirations(currentProject.id)
        } else if (doc.type === 'references') {
          await loadReferences(currentProject.id)
        } else if (doc.type === 'writingLogs') {
          await loadWritingLogs(currentProject.id)
        }
      }
    } catch (err) {
      console.error('保存文档失败:', err)
      alert('保存失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  const handleAiContinue = async (): Promise<void> => {
    if (!editorContent) return
    setAiLoading(true)
    try {
      const prompt = `请续写以下小说内容，保持风格一致：\n\n${editorContent}`
      const result = await window.api.aiChat(
        [
          {
            role: 'system',
            content: '你是一位专业的小说作家，请根据前文续写小说内容。保持语言风格、人物性格和情节走向一致。'
          },
          { role: 'user', content: prompt }
        ],
        { stream: true }
      )
      if (result) {
        setEditorContent(editorContent + '\n' + result)
      }
    } catch (err) {
      console.error('AI 续写失败:', err)
      alert('AI 续写失败，请检查 AI 设置是否正确。')
    } finally {
      setAiLoading(false)
    }
  }

  const activeDoc = openDocs.find((d) => d.id === activeDocId)

  useEffect(() => {
    if (!currentProject || !activeDoc) return
    if (activeDoc.type === 'characterRelations') {
      loadCharacters(currentProject.id)
      loadCharacterRelations(currentProject.id)
    }
  }, [activeDoc?.id, currentProject?.id])

  const handleOpenCharacterDoc = (characterId: string) => {
    const char = characters.find(c => c.id === characterId)
    if (!char) return
    const openDoc = useLayoutStore.getState().openDoc
    openDoc({
      id: `character:${char.id}`,
      type: 'character',
      title: char.name,
      entityId: char.id,
      content: '',
      dirty: false
    })
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* 标题栏 */}
      <TitleBar />

      {/* 主体区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 可拖拽面板 — 3 列布局 */}
        <PanelGroup orientation="horizontal" className="flex-1">
          {/* 左侧：项目树 */}
          <Panel id="sidebar" defaultSize="22%" minSize="16%" maxSize="40%">
            <Sidebar />
          </Panel>
          <PanelResizeHandle />

          {/* 中间：多标签页编辑器 */}
          <Panel id="editor" defaultSize="52%" minSize="25%">
            <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-surface)' }}>
              {/* 标签页栏 */}
              <DocTabs onSave={handleSaveDoc} saving={saving} />

              {/* 编辑器内容区 */}
              <div className="flex-1 overflow-auto">
                {activeDoc ? (
                  activeDoc.type === 'characterRelations' ? (
                    <div className="w-full h-full p-4">
                      <CharacterRelationGraph
                        projectId={currentProject!.id}
                        characters={characters}
                        relations={characterRelations}
                        width={900}
                        height={600}
                        onNodeClick={handleOpenCharacterDoc}
                        onRelationsGenerated={() => loadCharacterRelations(currentProject!.id)}
                      />
                    </div>
                  ) : activeDoc.type === 'chapter' ? (
                    <div className="mx-auto max-w-4xl h-full">
                      <ChapterDocEditor key={activeDoc.id} doc={activeDoc} />
                    </div>
                  ) : (
                    <div className="mx-auto max-w-4xl h-full">
                      <MarkdownDocEditor key={activeDoc.id} doc={activeDoc} />
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center" style={{ color: 'var(--color-text-dim)' }}>
                      <p className="text-sm mb-2">从左侧选择项目文件以开始编辑</p>
                      <p className="text-xs">点击项目名称、章节、角色等即可打开对应的 Markdown 文档</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* 右侧：根据左侧选择显示对应面板 */}
          <PanelResizeHandle />
          <Panel id="right" defaultSize="26%" minSize="16%" maxSize="45%">
            {sidebarView === 'characters' ? (
              <CharactersPanel />
            ) : sidebarView === 'world' ? (
              <WorldSettingsPanel />
            ) : sidebarView === 'timeline' ? (
              <TimelinePanel />
            ) : sidebarView === 'locations' ? (
              <LocationsPanel />
            ) : sidebarView === 'relations' ? (
              <CharacterRelationsPanel />
            ) : sidebarView === 'inspirations' ? (
              <InspirationsPanel />
            ) : sidebarView === 'logs' ? (
              <WritingLogsPanel />
            ) : sidebarView === 'references' ? (
              <ReferencesPanel />
            ) : sidebarView === 'writingStyles' ? (
              <WritingStylesPanel />
            ) : sidebarView === 'skills' ? (
              <SkillsPanel />
            ) : (
              <OutlinePanel />
            )}
          </Panel>
        </PanelGroup>

        {/* 右侧工具栏 */}
        <RightToolbar />
      </div>

      {/* 状态栏 */}
      <StatusBar />

      {/* AI 设置模态框 */}
      {showSettings && <AISettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
