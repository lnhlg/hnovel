import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  description: string
  synopsis: string
  path: string
  genre: string
  wordCountTarget: number
  status: string
  worldBackground: string
  storyProgress: string
  writingStyleId: string
  skillId: string
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: string
  projectId: string
  title: string
  content: string
  outline: string
  sortOrder: number
  wordCount: number
  status: string
  draftVersion: number
  storyProgressSynced: number
  createdAt: string
  updatedAt: string
}

export interface Character {
  id: string
  projectId: string
  name: string
  description: string
  traits: string
  age: number
  appearance: string
  background: string
  personality: string
  role: string
  skills: string
  relationships: string
  motivation: string
  flaws: string
  growthArc: string
  gender: string
  dynasty: string
  birthplace: string
  heightBuild: string
  face: string
  hairstyle: string
  clothing: string
  talents: string
  likes: string
  importantEvents: string
  relationshipsDetail: string
  weaknesses: string
  specialMarks: string
  createdAt: string
  updatedAt: string
}

export interface WorldSetting {
  id: string
  projectId: string
  category: string
  key: string
  value: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Timeline {
  id: string
  projectId: string
  title: string
  description: string
  date: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Dialogue {
  id: string
  projectId: string
  speaker: string
  with: string
  content: string
  context: string
  chapterId: string
  seq: number
  createdAt: string
  updatedAt: string
}

export interface Item {
  id: string
  projectId: string
  name: string
  description: string
  status: string
  owner: string
  chapterId: string
  appearance: string
  size: string
  pattern: string
  createdAt: string
  updatedAt: string
}

export interface Location {
  id: string
  projectId: string
  name: string
  description: string
  type: string
  createdAt: string
  updatedAt: string
}

export interface CharacterRelation {
  id: string
  projectId: string
  characterId1: string
  characterId2: string
  relation: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Inspiration {
  id: string
  projectId: string
  title: string
  content: string
  type: string
  source: string
  createdAt: string
}

export interface WritingLog {
  id: string
  projectId: string
  content: string
  createdAt: string
}

export interface Reference {
  id: string
  projectId: string
  title: string
  type: string
  url: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface WritingStyle {
  id: string
  projectId: string
  name: string
  description: string
  instructions: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  content: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface AppState {
  // 项目
  projects: Project[]
  currentProject: Project | null
  // 章节
  chapters: Chapter[]
  currentChapter: Chapter | null
  // 角色
  characters: Character[]
  // 世界观设定
  worldSettings: WorldSetting[]
  // 时间线
  timelines: Timeline[]
  // 对话
  dialogues: Dialogue[]
  // 物品
  items: Item[]
  // 地点场景
  locations: Location[]
  // 角色关系
  characterRelations: CharacterRelation[]
  // 灵感记录
  inspirations: Inspiration[]
  // 写作日志
  writingLogs: WritingLog[]
  // 参考资料
  references: Reference[]
  // 编辑器
  editorContent: string
  editorMode: 'richtext' | 'markdown'
  // AI 对话参数（跨会话记忆）
  chatModel: string
  chatProviderId: string
  chatReasoningEffort: 'low' | 'medium' | 'high' | 'max'
  // 操作
  loadProjects: () => Promise<void>
  setCurrentProject: (project: Project | null) => void
  setCurrentChapter: (chapter: Chapter | null) => void
  setEditorContent: (content: string) => void
  setEditorMode: (mode: 'richtext' | 'markdown') => void
  loadChapters: (projectId: string) => Promise<void>
  saveCurrentChapter: () => Promise<void>
  createChapter: (projectId: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  loadCharacters: (projectId: string) => Promise<void>
  saveCharacter: (data: Partial<Character> & { projectId: string }) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  saveProjectSynopsis: (projectId: string, synopsis: string) => Promise<void>
  saveChapterOutline: (chapterId: string, outline: string) => Promise<void>
  aiGenerateChapter: (opts: {
    projectId: string
    chapterId: string
    synopsis: string
    chapterTitle: string
    chapterOutline: string
    previousChapters: { title: string; content: string }[]
  }) => Promise<string>
  aiPlanChapters: (opts: { synopsis: string; numChapters: number }) => Promise<unknown>
  // AI 资产生成
  aiGenerate: (req: {
    type: 'character' | 'world' | 'timeline' | 'location' | 'relation' | 'inspiration' | 'reference' | 'character-batch' | 'world-batch' | 'timeline-batch' | 'location-batch' | 'inspiration-batch' | 'reference-batch' | 'chapter-outline'
    projectId: string
    hint?: string
    count?: number
    chapterTitle?: string
    chapterContent?: string
  }) => Promise<{ data?: unknown; error?: string; raw?: string }>
  // AI 对话参数
  setChatModel: (model: string) => void
  setChatProviderId: (providerId: string) => void
  setChatReasoningEffort: (effort: 'low' | 'medium' | 'high' | 'max') => void
  // 世界观设定操作
  loadWorldSettings: (projectId: string) => Promise<void>
  saveWorldSetting: (data: Partial<WorldSetting> & { projectId: string }) => Promise<void>
  deleteWorldSetting: (id: string) => Promise<void>
  // 时间线操作
  loadTimelines: (projectId: string) => Promise<void>
  saveTimeline: (data: Partial<Timeline> & { projectId: string }) => Promise<void>
  deleteTimeline: (id: string) => Promise<void>
  // 对话操作
  loadDialogues: (projectId: string) => Promise<void>
  saveDialogue: (data: Partial<Dialogue> & { projectId: string }) => Promise<void>
  deleteDialogue: (id: string) => Promise<void>
  // 物品操作
  loadItems: (projectId: string) => Promise<void>
  saveItem: (data: Partial<Item> & { projectId: string }) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  // 地点场景操作
  loadLocations: (projectId: string) => Promise<void>
  saveLocation: (data: Partial<Location> & { projectId: string }) => Promise<void>
  deleteLocation: (id: string) => Promise<void>
  // 角色关系操作
  loadCharacterRelations: (projectId: string) => Promise<void>
  saveCharacterRelation: (data: Partial<CharacterRelation> & { projectId: string }) => Promise<void>
  deleteCharacterRelation: (id: string) => Promise<void>
  // 灵感记录操作
  loadInspirations: (projectId: string) => Promise<void>
  saveInspiration: (data: Partial<Inspiration> & { projectId: string }) => Promise<void>
  deleteInspiration: (id: string) => Promise<void>
  // 写作日志操作
  loadWritingLogs: (projectId: string) => Promise<void>
  addWritingLog: (projectId: string, content: string) => Promise<void>
  deleteWritingLog: (id: string) => Promise<void>
  // 参考资料操作
  loadReferences: (projectId: string) => Promise<void>
  saveReference: (data: Partial<Reference> & { projectId: string }) => Promise<void>
  deleteReference: (id: string) => Promise<void>
  // 写作风格操作（全局，不依赖项目）
  writingStyles: WritingStyle[]
  loadWritingStyles: () => Promise<void>
  saveWritingStyle: (data: Partial<WritingStyle>) => Promise<void>
  deleteWritingStyle: (id: string) => Promise<void>
  // 技能操作（全局）
  skills: Skill[]
  loadSkills: () => Promise<void>
  saveSkill: (data: Partial<Skill>) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  // 故事进展摘要
  storyProgress: string
  loadStoryProgress: (projectId: string) => Promise<void>
  saveStoryProgress: (projectId: string, text: string) => Promise<void>
  autoUpdateStoryProgress: (projectId: string) => Promise<string>
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  projects: [],
  currentProject: null,
  chapters: [],
  currentChapter: null,
  characters: [],
  worldSettings: [],
  timelines: [],
  locations: [],
  dialogues: [],
  items: [],
  characterRelations: [],
  inspirations: [],
  writingLogs: [],
  references: [],
  writingStyles: [],
  skills: [],
  editorContent: '',
  editorMode: 'richtext',
  chatModel: '',
  chatProviderId: '',
  chatReasoningEffort: 'medium' as const,
  storyProgress: '',

  loadProjects: async () => {
    const projects = await window.api.listProjects()
    set({ projects })
  },

  setCurrentProject: (project) => set({ currentProject: project }),

  setCurrentChapter: (chapter) =>
    set({
      currentChapter: chapter,
      editorContent: chapter?.content ?? ''
    }),

  setEditorContent: (content) => set({ editorContent: content }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  setChatModel: (model) => set({ chatModel: model }),

  setChatProviderId: (providerId) => set({ chatProviderId: providerId }),

  setChatReasoningEffort: (effort) => set({ chatReasoningEffort: effort }),

  loadChapters: async (projectId) => {
    const chapters = await window.api.getChapters(projectId)
    set({ chapters })
  },

  saveCurrentChapter: async () => {
    const { currentChapter, editorContent } = get()
    if (!currentChapter) return
    const saved = await window.api.saveChapter({
      id: currentChapter.id,
      projectId: currentChapter.projectId,
      title: currentChapter.title,
      content: editorContent
    })
    set({ currentChapter: saved })
  },

  createChapter: async (projectId) => {
    const chapter = await window.api.createChapter(projectId)
    const { chapters } = get()
    set({ chapters: [...chapters, chapter] })
  },

  deleteProject: async (id) => {
    await window.api.deleteProject(id)
    const { projects, currentProject } = get()
    const isCurrent = currentProject?.id === id
    set({
      projects: projects.filter((p) => p.id !== id),
      currentProject: isCurrent ? null : currentProject,
      chapters: isCurrent ? [] : get().chapters,
      currentChapter: isCurrent ? null : get().currentChapter,
      characters: isCurrent ? [] : get().characters,
      worldSettings: isCurrent ? [] : get().worldSettings,
      timelines: isCurrent ? [] : get().timelines,
      locations: isCurrent ? [] : get().locations,
      dialogues: isCurrent ? [] : get().dialogues,
      items: isCurrent ? [] : get().items,
      characterRelations: isCurrent ? [] : get().characterRelations,
      inspirations: isCurrent ? [] : get().inspirations,
      writingLogs: isCurrent ? [] : get().writingLogs,
      references: isCurrent ? [] : get().references,
      writingStyles: isCurrent ? [] : get().writingStyles,
      editorContent: isCurrent ? '' : get().editorContent
    })
  },

  deleteChapter: async (id) => {
    await window.api.deleteChapter(id)
    const { chapters, currentChapter } = get()
    set({
      chapters: chapters.filter((c) => c.id !== id),
      currentChapter: currentChapter?.id === id ? null : currentChapter,
      editorContent: currentChapter?.id === id ? '' : get().editorContent
    })
  },

  loadCharacters: async (projectId) => {
    const characters = await window.api.getCharacters(projectId)
    set({ characters })
  },

  saveCharacter: async (data) => {
    const saved = await window.api.saveCharacter(data)
    if (!saved) throw new Error('保存角色失败：后端返回空')
    const { characters } = get()
    const existingIdx = characters.findIndex((c) => c.id === saved.id)
    if (existingIdx >= 0) {
      const updated = [...characters]
      updated[existingIdx] = saved
      set({ characters: updated })
    } else {
      set({ characters: [...characters, saved] })
    }
  },

  deleteCharacter: async (id) => {
    await window.api.deleteCharacter(id)
    const { characters } = get()
    set({ characters: characters.filter((c) => c.id !== id) })
  },

  saveProjectSynopsis: async (projectId, synopsis) => {
    const saved = await window.api.saveProjectSynopsis(projectId, synopsis)
    set({ currentProject: saved })
  },

  saveChapterOutline: async (chapterId, outline) => {
    const saved = await window.api.saveChapterOutline(chapterId, outline)
    const { chapters } = get()
    set({
      chapters: chapters.map((c) => (c.id === saved.id ? saved : c)),
      currentChapter: get().currentChapter?.id === saved.id ? saved : get().currentChapter
    })
  },

  aiGenerateChapter: async (opts) => {
    return await window.api.generateChapter(opts)
  },

  aiPlanChapters: async (opts) => {
    return await window.api.planChapters(opts)
  },

  // AI 资产生成
  aiGenerate: async (req) => {
    const { currentProject, characters, worldSettings, locations } = get()
    const { chapterTitle, chapterContent, ...rest } = req
    return await window.api.generateAsset({
      ...rest,
      context: {
        name: currentProject?.name ?? '',
        genre: currentProject?.genre ?? '',
        synopsis: currentProject?.synopsis ?? '',
        worldBackground: currentProject?.worldBackground ?? '',
        characters: characters.map(c => ({ name: c.name, role: c.role, description: c.description })),
        worldSettings: worldSettings.map(w => ({ category: w.category, key: w.key, value: w.value })),
        locations: locations.map(l => ({ name: l.name, type: l.type })),
        chapterTitle,
        chapterContent
      }
    })
  },

  // 世界观设定操作
  loadWorldSettings: async (projectId) => {
    const settings = await window.api.getWorldSettings(projectId)
    set({ worldSettings: settings })
  },

  saveWorldSetting: async (data) => {
    const saved = await window.api.saveWorldSetting(data)
    if (!saved) throw new Error('保存世界观设定失败：后端返回空')
    const { worldSettings } = get()
    const existingIdx = worldSettings.findIndex((s) => s.id === saved.id)
    if (existingIdx >= 0) {
      const updated = [...worldSettings]
      updated[existingIdx] = saved
      set({ worldSettings: updated })
    } else {
      set({ worldSettings: [...worldSettings, saved] })
    }
  },

  deleteWorldSetting: async (id) => {
    await window.api.deleteWorldSetting(id)
    const { worldSettings } = get()
    set({ worldSettings: worldSettings.filter((s) => s.id !== id) })
  },

  // 时间线操作
  loadTimelines: async (projectId) => {
    const timelines = await window.api.getTimelines(projectId)
    set({ timelines })
  },

  saveTimeline: async (data) => {
    const saved = await window.api.saveTimeline(data)
    const { timelines } = get()
    if (data.id) {
      set({ timelines: timelines.map((t) => (t.id === saved.id ? saved : t)) })
    } else {
      set({ timelines: [...timelines, saved] })
    }
  },

  deleteTimeline: async (id) => {
    await window.api.deleteTimeline(id)
    const { timelines } = get()
    set({ timelines: timelines.filter((t) => t.id !== id) })
  },

  // 地点场景操作
  loadLocations: async (projectId) => {
    const locations = await window.api.getLocations(projectId)
    set({ locations })
  },

  saveLocation: async (data) => {
    const saved = await window.api.saveLocation(data)
    if (!saved) throw new Error('保存地点失败：后端返回空')
    const { locations } = get()
    const existingIdx = locations.findIndex((l) => l.id === saved.id)
    if (existingIdx >= 0) {
      const updated = [...locations]
      updated[existingIdx] = saved
      set({ locations: updated })
    } else {
      set({ locations: [...locations, saved] })
    }
  },

  deleteLocation: async (id) => {
    await window.api.deleteLocation(id)
    const { locations } = get()
    set({ locations: locations.filter((l) => l.id !== id) })
  },

  // 物品操作
  loadItems: async (projectId) => {
    const items = await window.api.getItems(projectId)
    set({ items })
  },

  saveItem: async (data) => {
    const saved = await window.api.saveItem(data)
    if (!saved) throw new Error('保存物品失败：后端返回空')
    const { items } = get()
    const existingIdx = items.findIndex((i) => i.id === saved.id)
    if (existingIdx >= 0) {
      const updated = [...items]
      updated[existingIdx] = saved
      set({ items: updated })
    } else {
      set({ items: [...items, saved] })
    }
  },

  deleteItem: async (id) => {
    await window.api.deleteItem(id)
    const { items } = get()
    set({ items: items.filter((i) => i.id !== id) })
  },

  // 对话操作
  loadDialogues: async (projectId) => {
    const dialogues = await window.api.getDialogues(projectId)
    set({ dialogues })
  },

  saveDialogue: async (data) => {
    const saved = await window.api.saveDialogue(data)
    if (!saved) throw new Error('保存对话失败：后端返回空')
    const { dialogues } = get()
    const existingIdx = dialogues.findIndex((d) => d.id === saved.id)
    if (existingIdx >= 0) {
      const updated = [...dialogues]
      updated[existingIdx] = saved
      set({ dialogues: updated })
    } else {
      set({ dialogues: [...dialogues, saved] })
    }
  },

  deleteDialogue: async (id) => {
    await window.api.deleteDialogue(id)
    const { dialogues } = get()
    set({ dialogues: dialogues.filter((d) => d.id !== id) })
  },

  // 角色关系操作
  loadCharacterRelations: async (projectId) => {
    const relations = await window.api.getCharacterRelations(projectId)
    set({ characterRelations: relations })
  },

  saveCharacterRelation: async (data) => {
    const saved = await window.api.saveCharacterRelation(data)
    const { characterRelations } = get()
    if (data.id) {
      set({ characterRelations: characterRelations.map((r) => (r.id === saved.id ? saved : r)) })
    } else {
      set({ characterRelations: [...characterRelations, saved] })
    }
  },

  deleteCharacterRelation: async (id) => {
    await window.api.deleteCharacterRelation(id)
    const { characterRelations } = get()
    set({ characterRelations: characterRelations.filter((r) => r.id !== id) })
  },

  // 灵感记录操作
  loadInspirations: async (projectId) => {
    const inspirations = await window.api.getInspirations(projectId)
    set({ inspirations })
  },

  saveInspiration: async (data) => {
    const saved = await window.api.saveInspiration(data)
    const { inspirations } = get()
    if (data.id) {
      set({ inspirations: inspirations.map((i) => (i.id === saved.id ? saved : i)) })
    } else {
      set({ inspirations: [...inspirations, saved] })
    }
  },

  deleteInspiration: async (id) => {
    await window.api.deleteInspiration(id)
    const { inspirations } = get()
    set({ inspirations: inspirations.filter((i) => i.id !== id) })
  },

  // 写作日志操作
  loadWritingLogs: async (projectId) => {
    const logs = await window.api.getWritingLogs(projectId)
    set({ writingLogs: logs })
  },

  addWritingLog: async (projectId, content) => {
    const saved = await window.api.addWritingLog(projectId, content)
    const { writingLogs } = get()
    set({ writingLogs: [saved, ...writingLogs] })
  },

  deleteWritingLog: async (id) => {
    await window.api.deleteWritingLog(id)
    const { writingLogs } = get()
    set({ writingLogs: writingLogs.filter((l) => l.id !== id) })
  },

  // 参考资料操作
  loadReferences: async (projectId) => {
    const references = await window.api.getReferences(projectId)
    set({ references })
  },

  saveReference: async (data) => {
    const saved = await window.api.saveReference(data)
    const { references } = get()
    if (data.id) {
      set({ references: references.map((r) => (r.id === saved.id ? saved : r)) })
    } else {
      set({ references: [...references, saved] })
    }
  },

  deleteReference: async (id) => {
    await window.api.deleteReference(id)
    const { references } = get()
    set({ references: references.filter((r) => r.id !== id) })
  },

  // 写作风格操作
  loadWritingStyles: async () => {
    const styles = await window.api.getWritingStyles()
    set({ writingStyles: styles })
  },

  saveWritingStyle: async (data) => {
    const saved = await window.api.saveWritingStyle(data)
    const { writingStyles } = get()
    set({ writingStyles: [...writingStyles.filter(s => s.id !== saved.id), saved] })
  },

  deleteWritingStyle: async (id) => {
    await window.api.deleteWritingStyle(id)
    const { writingStyles } = get()
    set({ writingStyles: writingStyles.filter((s) => s.id !== id) })
  },

  // 技能操作
  loadSkills: async () => {
    const skills = await window.api.getSkills()
    set({ skills })
  },

  saveSkill: async (data) => {
    const saved = await window.api.saveSkill(data)
    const { skills } = get()
    set({ skills: [...skills.filter(s => s.id !== saved.id), saved] })
  },

  deleteSkill: async (id) => {
    await window.api.deleteSkill(id)
    const { skills } = get()
    set({ skills: skills.filter((s) => s.id !== id) })
  },

  loadStoryProgress: async (projectId) => {
    const text = await window.api.getStoryProgress(projectId)
    set({ storyProgress: text })
  },

  saveStoryProgress: async (projectId, text) => {
    await window.api.saveStoryProgress(projectId, text)
    set({ storyProgress: text })
  },

  autoUpdateStoryProgress: async (projectId) => {
    const text = await window.api.autoUpdateStoryProgress(projectId)
    set({ storyProgress: text })
    return text
  }
})),
  {
    name: 'novelwriter-chat-prefs',
    partialize: (state) => ({
      chatModel: state.chatModel,
      chatProviderId: state.chatProviderId,
      chatReasoningEffort: state.chatReasoningEffort
    })
  }
)
