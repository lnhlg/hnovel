import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/app'
import AIGenerateDialog from './AIGenerateDialog'

function OutlinePanel(): JSX.Element {
  const {
    currentProject,
    chapters,
    currentChapter,
    saveProjectSynopsis,
    saveChapterOutline,
    aiGenerateChapter,
    loadChapters,
    storyProgress,
    loadStoryProgress,
    saveStoryProgress,
    autoUpdateStoryProgress,
    writingStyles,
    loadWritingStyles
  } = useAppStore()

  const [synopsis, setSynopsis] = useState(currentProject?.synopsis ?? '')
  const [synopsisSaved, setSynopsisSaved] = useState(true)
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null)
  const [outlineDraft, setOutlineDraft] = useState('')
  const [planning, setPlanning] = useState(false)
  const [planResult, setPlanResult] = useState<string | null>(null)
  const [genDialogChapter, setGenDialogChapter] = useState<{ id: string; title: string } | null>(null)
  const [storyProgressDraft, setStoryProgressDraft] = useState('')
  const [editingProgress, setEditingProgress] = useState(false)
  const [progressUpdating, setProgressUpdating] = useState(false)

  // Sync synopsis when currentProject changes
  useEffect(() => {
    setSynopsis(currentProject?.synopsis ?? '')
    setSynopsisSaved(true)
  }, [currentProject?.id])

  // Load storyProgress when project changes
  useEffect(() => {
    if (!currentProject?.id) return
    loadStoryProgress(currentProject.id)
    loadWritingStyles()
  }, [currentProject?.id])

  // Sync storyProgressDraft when storyProgress loads
  useEffect(() => {
    setStoryProgressDraft(storyProgress)
  }, [storyProgress])

  const handleSaveSynopsis = async (): Promise<void> => {
    if (!currentProject) return
    await saveProjectSynopsis(currentProject.id, synopsis)
    setSynopsisSaved(true)
  }

  const handleStartEditOutline = (chapter: typeof currentChapter): void => {
    if (!chapter) return
    setEditingOutlineId(chapter.id)
    setOutlineDraft(chapter.outline ?? '')
  }

  const handleSaveOutline = async (chapterId: string): Promise<void> => {
    await saveChapterOutline(chapterId, outlineDraft)
    setEditingOutlineId(null)
  }

  const runGenerateChapter = async (chapterId: string): Promise<void> => {
    if (!currentProject) return
    const chapter = chapters.find((c) => c.id === chapterId)
    if (!chapter) return

    const prevChapters = chapters
      .filter((c) => c.sortOrder < chapter.sortOrder && c.id !== chapter.id)
      .map((c) => ({
        title: c.title,
        content: c.content
      }))

    const content = await aiGenerateChapter({
      projectId: currentProject.id,
      chapterId: chapter.id,
      synopsis: currentProject.synopsis,
      chapterTitle: chapter.title,
      chapterOutline: chapter.outline,
      previousChapters: prevChapters
    })

    // 保存生成的章节内容
    if (content) {
      await window.api.saveChapter({
        id: chapter.id,
        projectId: currentProject.id,
        title: chapter.title,
        content,
        outline: chapter.outline
      })
    }
    // 重新加载章节
    await loadChapters(currentProject.id)
  }

  const handlePlanChapters = async (): Promise<void> => {
    if (!currentProject || !synopsis.trim()) {
      alert('请先填写小说大纲（synopsis）')
      return
    }
    setPlanning(true)
    setPlanResult(null)
    try {
      const result = await useAppStore.getState().aiPlanChapters({
        synopsis,
        numChapters: 10
      })
      if (result && Array.isArray(result)) {
        // 批量创建章节
        for (const ch of result as { title: string; outline: string }[]) {
          const chapter = await window.api.createChapter(currentProject.id)
          await saveChapterOutline(chapter.id, ch.outline)
          await window.api.saveChapter({
            id: chapter.id,
            projectId: currentProject.id,
            title: ch.title,
            content: '',
            outline: ch.outline
          })
        }
        await loadChapters(currentProject.id)
        setPlanResult(`成功生成 ${result.length} 章规划！`)
      } else {
        setPlanResult('AI 返回格式有误，请重试。')
      }
    } catch (err) {
      console.error('规划失败:', err)
      setPlanResult('规划失败，请检查 AI 设置。')
    } finally {
      setPlanning(false)
    }
  }

  const handleAutoUpdateProgress = async (): Promise<void> => {
    if (!currentProject) return
    setProgressUpdating(true)
    try {
      await autoUpdateStoryProgress(currentProject.id)
    } catch (err) {
      console.error('更新故事进展失败:', err)
    } finally {
      setProgressUpdating(false)
    }
  }

  const handleSaveProgress = async (): Promise<void> => {
    if (!currentProject) return
    await saveStoryProgress(currentProject.id, storyProgressDraft)
    setEditingProgress(false)
  }

  if (!currentProject) {
    return (
      <div className="p-4 text-sm text-gray-400">
        选择一个项目查看和编辑大纲
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tab 标题 */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          大纲规划
        </h3>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 项目 synopsis */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            小说大纲 / Synopsis
          </label>
          <textarea
            value={synopsis}
            onChange={(e) => {
              setSynopsis(e.target.value)
              setSynopsisSaved(false)
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs leading-relaxed outline-none focus:border-primary-400 resize-none"
            rows={8}
            placeholder="写下你的小说整体大纲：故事背景、主要情节线、结局构想..."
          />
          <div className="mt-1 flex gap-1">
            <button
              onClick={handleSaveSynopsis}
              disabled={synopsisSaved}
              className="rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600 disabled:opacity-50"
            >
              {synopsisSaved ? '已保存' : '保存大纲'}
            </button>
            <button
              onClick={handlePlanChapters}
              disabled={planning || !synopsis.trim()}
              className="rounded border border-primary-300 px-3 py-1 text-xs text-primary-600 hover:bg-primary-50 disabled:opacity-50"
            >
              {planning ? '规划中...' : 'AI 规划章节'}
            </button>
          </div>
          {planResult && (
            <p className="mt-1 text-xs text-green-600">{planResult}</p>
          )}
        </div>

        {/* 项目文风选择 */}
        {currentProject && writingStyles.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              项目写作风格
            </label>
            <select
              value={currentProject.writingStyleId || ''}
              onChange={async (e) => {
                const val = e.target.value
                await window.api.saveProject({
                  id: currentProject.id,
                  writingStyleId: val
                })
                // 刷新当前项目
                const updated = await window.api.openProject(currentProject.id)
                if (updated) useAppStore.setState({ currentProject: updated })
              }}
              className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-primary-400"
              style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <option value="">（不指定，使用所有风格）</option>
              {writingStyles.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 故事进展摘要 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            故事进展摘要
            <span className="ml-2 text-gray-300 font-normal">（自动跟踪已完成章节的剧情、伏笔、角色变化）</span>
          </label>
          {editingProgress ? (
            <textarea
              value={storyProgressDraft}
              onChange={(e) => setStoryProgressDraft(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs leading-relaxed outline-none focus:border-primary-400 resize-none font-mono"
              rows={12}
              placeholder="点击「自动更新」从已有章节大纲构建故事进展，或手动编辑..."
            />
          ) : (
            <div
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto cursor-pointer"
              onClick={() => {
                setStoryProgressDraft(storyProgress)
                setEditingProgress(true)
              }}
            >
              {storyProgress || '（暂无故事进展，点击「自动更新」从已有章节大纲构建，或点击此处开始编辑）'}
            </div>
          )}
          <div className="mt-1 flex gap-1">
            {editingProgress ? (
              <>
                <button
                  onClick={handleSaveProgress}
                  className="rounded bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setStoryProgressDraft(storyProgress)
                    setEditingProgress(false)
                  }}
                  className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                onClick={handleAutoUpdateProgress}
                disabled={progressUpdating}
                className="rounded border border-primary-300 px-3 py-1 text-xs text-primary-600 hover:bg-primary-50 disabled:opacity-50"
              >
                {progressUpdating ? '更新中...' : '自动更新'}
              </button>
            )}
          </div>
        </div>

        {/* 章节大纲列表 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            章节大纲
          </label>
          <div className="space-y-2">
            {chapters.map((ch) => (
              <div key={ch.id} className="rounded-lg border border-gray-100 p-3 hover:border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">
                    {ch.sortOrder + 1}. {ch.title}
                  </h4>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGenDialogChapter({ id: ch.id, title: ch.title })}
                      disabled={!ch.outline?.trim()}
                      className="text-xs text-primary-500 hover:text-primary-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      AI 生成
                    </button>
                    <button
                      onClick={() => handleStartEditOutline(ch)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      编辑大纲
                    </button>
                  </div>
                </div>
                {editingOutlineId === ch.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={outlineDraft}
                      onChange={(e) => setOutlineDraft(e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-xs resize-none"
                      rows={3}
                      placeholder="本章概要..."
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveOutline(ch.id)}
                        className="rounded bg-primary-500 px-2 py-0.5 text-xs text-white hover:bg-primary-600"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingOutlineId(null)}
                        className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  ch.outline && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-3">{ch.outline}</p>
                  )
                )}
                {!ch.outline && editingOutlineId !== ch.id && (
                  <p className="mt-1 text-xs text-gray-300 italic">暂无大纲，点击"编辑大纲"添加</p>
                )}
              </div>
            ))}
            {chapters.length === 0 && (
              <p className="text-xs text-gray-400">暂无章节，请先创建章节</p>
            )}
          </div>
        </div>
      </div>

      {/* AI 生成确认与进度对话框 */}
      {genDialogChapter && (
        <AIGenerateDialog
          title="AI 生成章节"
          chapterTitle={genDialogChapter.title}
          onClose={() => setGenDialogChapter(null)}
          onStart={async () => {
            await runGenerateChapter(genDialogChapter.id)
          }}
        />
      )}
    </div>
  )
}

export default OutlinePanel
