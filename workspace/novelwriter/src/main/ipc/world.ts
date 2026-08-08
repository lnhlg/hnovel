import { randomUUID } from 'crypto'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { mkdirSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  Project, Chapter, Character, WorldSetting, Timeline, Location, Item, Dialogue, CharacterRelation, Inspiration, WritingLog, Reference, WritingStyle, Skill,
  loadProjects, saveProject, deleteProject, loadProjectById,
  loadStoryProgress, saveStoryProgress,
  loadChapters, saveChapter, deleteChapter,
  loadCharacters, saveCharacter, deleteCharacter,
  loadWorldSettings, saveWorldSetting, deleteWorldSetting,
  loadTimelines, saveTimeline, deleteTimeline,
  loadLocations, saveLocation, deleteLocation,
  loadItems, saveItem, deleteItem,
  loadDialogues, saveDialogue, deleteDialogue,
  loadCharacterRelations, saveCharacterRelation, deleteCharacterRelation,
  loadCharacterPositions, saveCharacterPositions,
  loadInspirations, saveInspiration, deleteInspiration,
  loadWritingLogs, saveWritingLog, deleteWritingLog,
  loadReferences, saveReference, deleteReference,
  loadWritingStyles, saveWritingStyle, deleteWritingStyle, getNextWritingStyleSortOrder,
  loadSkills, saveSkill, deleteSkill, getNextSkillSortOrder,
  loadAIProviders
} from '../fileStorage'
import {
  getActiveProvider,
  getCurrentModel,
  setCurrentModel,
  chatOpenAI,
  chatOpenAIStream,
  chatOllama,
  loadActiveProvider,
  listOpenAIModels,
  listOllamaModels
} from '../ai'
import type { ChatMessage } from '../ai'
import type { AIProvider } from '../fileStorage'
import {
  ensureProjectDirs,
  saveProjectMD,
  saveCharacterMD,
  deleteCharacterMD,
  saveWorldSettingMD,
  deleteWorldSettingMD,
  saveChapterMD,
  deleteChapterMD,
  saveTimelineMD,
  saveLocationMD,
  deleteLocationMD,
  saveCharacterRelationsMD,
  saveInspirationsMD,
  saveReferencesMD,
  saveWritingLogsMD,
  saveAllProjectDataMD,
  readProjectContent,
  writeProjectContent,
  readCharacterContent,
  writeCharacterContent,
  readChapterContent,
  writeChapterContent,
  readWorldSettingContent,
  writeWorldSettingContent,
  readLocationContent,
  writeLocationContent,
  readTimelineContent,
  writeTimelineContent,
  readCharacterRelationsContent,
  writeCharacterRelationsContent,
  readInspirationsContent,
  writeInspirationsContent,
  readReferencesContent,
  writeReferencesContent,
  readWritingLogsContent,
  writeWritingLogsContent,
  readProjectMD,
  readCharacterMD,
  saveCharactersMD,
  readCharactersContent,
  writeCharactersContent,
  saveWorldSettingsMD,
  readWorldSettingsContent,
  writeWorldSettingsContent,
  saveLocationsMD,
  readLocationsContent,
  writeLocationsContent,
  parseCharactersFromMD,
  parseWorldSettingsFromMD,
  parseLocationsFromMD,
  stripChapterTitle,
  saveStoryProgressMD,
  readStoryProgressMD
} from '../markdownStorage'
import { now, extractTitleFromBody, extractTitleFromBodyMD, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges } from './helpers'



export function registerWorldSettingsHandlers(): void {
  ipcMain.handle('worldSettings:list', (_event, projectId: string) => {
    return loadWorldSettings(projectId).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      return a.key.localeCompare(b.key)
    })
  })

  ipcMain.handle('worldSettings:save', (_event, data: Partial<WorldSetting> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadWorldSettings(data.projectId).find(s => s.id === data.id) : null

    if (existing) {
      const setting: WorldSetting = {
        ...existing,
        category: data.category ?? existing.category,
        key: data.key ?? existing.key,
        value: data.value ?? existing.value,
        description: data.description ?? existing.description,
        rules: data.rules ?? existing.rules,
        relatedSettings: data.relatedSettings ?? existing.relatedSettings,
        plotImpact: data.plotImpact ?? existing.plotImpact,
        limitations: data.limitations ?? existing.limitations,
        examples: data.examples ?? existing.examples,
        updatedAt: time
      }
      saveWorldSetting(data.projectId, setting)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveWorldSettingMD(project.path, setting)
        saveWorldSettingsMD(project.path, loadWorldSettings(data.projectId))
      }

      return setting
    } else {
      const id = data.id || randomUUID()
      const setting: WorldSetting = {
        id,
        projectId: data.projectId,
        category: data.category ?? '',
        key: data.key ?? '',
        value: data.value ?? '',
        description: data.description ?? '',
        rules: data.rules ?? '',
        relatedSettings: data.relatedSettings ?? '',
        plotImpact: data.plotImpact ?? '',
        limitations: data.limitations ?? '',
        examples: data.examples ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveWorldSetting(data.projectId, setting)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveWorldSettingMD(project.path, setting)
        saveWorldSettingsMD(project.path, loadWorldSettings(data.projectId))
      }

      return setting
    }
  })

  ipcMain.handle('worldSettings:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const settings = loadWorldSettings(project.id)
      const setting = settings.find(s => s.id === id)
      if (setting) {
        deleteWorldSetting(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteWorldSettingMD(project.path, setting.category ?? '', setting.key ?? '')
          saveWorldSettingsMD(project.path, loadWorldSettings(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}



export function registerTimelineHandlers(): void {
  ipcMain.handle('timeline:list', (_event, projectId: string) => {
    return loadTimelines(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('timeline:save', (_event, data: Partial<Timeline> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadTimelines(data.projectId).find(t => t.id === data.id)
      if (!existing) return undefined
      const timeline: Timeline = {
        ...existing,
        title: data.title ?? existing.title,
        description: data.description ?? existing.description,
        date: data.date ?? existing.date,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        chapterId: data.chapterId ?? existing.chapterId,
        updatedAt: time
      }
      saveTimeline(data.projectId, timeline)

      // 同步保存到 MD 文件（需要所有时间线数据）
      if (project && project.path) {
        const allTimelines = loadTimelines(data.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        saveTimelineMD(project.path, allTimelines)
      }

      return timeline
    } else {
      const id = randomUUID()
      const timelines = loadTimelines(data.projectId)
      const sortOrder = timelines.length > 0 ? Math.max(...timelines.map(t => t.sortOrder)) + 1 : 0
      const timeline: Timeline = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        description: data.description ?? '',
        date: data.date ?? '',
        sortOrder,
        chapterId: data.chapterId ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveTimeline(data.projectId, timeline)

      // 同步保存到 MD 文件
      if (project && project.path) {
        const allTimelines = loadTimelines(data.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        saveTimelineMD(project.path, allTimelines)
      }

      return timeline
    }
  })

  ipcMain.handle('timeline:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const timelines = loadTimelines(project.id)
      const timeline = timelines.find(t => t.id === id)
      if (timeline) {
        deleteTimeline(project.id, id)
        // 同步保存到 MD 文件（删除后重新生成）
        if (project.path) {
          const allTimelines = loadTimelines(project.id).sort((a, b) => a.sortOrder - b.sortOrder)
          saveTimelineMD(project.path, allTimelines)
        }
        break
      }
    }
    return { success: true }
  })
}



export function registerLocationHandlers(): void {
  ipcMain.handle('location:list', (_event, projectId: string) => {
    return loadLocations(projectId).sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle('location:save', (_event, data: Partial<Location> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadLocations(data.projectId).find(l => l.id === data.id) : null

    if (existing) {
      const location: Location = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        type: data.type ?? existing.type,
        updatedAt: time
      }
      saveLocation(data.projectId, location)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveLocationMD(project.path, location)
        saveLocationsMD(project.path, loadLocations(data.projectId))
      }

      return location
    } else {
      const id = data.id || randomUUID()
      const location: Location = {
        id,
        projectId: data.projectId,
        name: data.name ?? '',
        description: data.description ?? '',
        type: data.type ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveLocation(data.projectId, location)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveLocationMD(project.path, location)
        saveLocationsMD(project.path, loadLocations(data.projectId))
      }

      return location
    }
  })

  ipcMain.handle('location:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const locations = loadLocations(project.id)
      const location = locations.find(l => l.id === id)
      if (location) {
        deleteLocation(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteLocationMD(project.path, location.name)
          saveLocationsMD(project.path, loadLocations(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}



export function registerItemHandlers(): void {
  ipcMain.handle('item:list', (_event, projectId: string) => {
    return loadItems(projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })

  ipcMain.handle('item:save', (_event, data: Partial<Item> & { projectId: string }) => {
    const time = now()
    const existing = data.id ? loadItems(data.projectId).find(i => i.id === data.id) : null

    if (existing) {
      const item: Item = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        status: data.status ?? existing.status,
        owner: data.owner ?? existing.owner,
        chapterId: data.chapterId ?? existing.chapterId,
        appearance: data.appearance ?? existing.appearance,
        size: data.size ?? existing.size,
        pattern: data.pattern ?? existing.pattern,
        updatedAt: time
      }
      saveItem(data.projectId, item)
      return item
    } else {
      const id = data.id || randomUUID()
      const item: Item = {
        id, projectId: data.projectId,
        name: data.name ?? '',
        description: data.description ?? '',
        status: data.status ?? '',
        owner: data.owner ?? '',
        chapterId: data.chapterId ?? '',
        appearance: data.appearance ?? '',
        size: data.size ?? '',
        pattern: data.pattern ?? '',
        createdAt: time, updatedAt: time
      }
      saveItem(data.projectId, item)
      return item
    }
  })

  ipcMain.handle('item:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const items = loadItems(project.id)
      const item = items.find(i => i.id === id)
      if (item) {
        deleteItem(project.id, id)
        break
      }
    }
    return { success: true }
  })
}



export function registerDialogueHandlers(): void {
  ipcMain.handle('dialogue:list', (_event, projectId: string) => {
    return loadDialogues(projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })

  ipcMain.handle('dialogue:save', (_event, data: Partial<Dialogue> & { projectId: string }) => {
    const time = now()
    const existing = data.id ? loadDialogues(data.projectId).find(d => d.id === data.id) : null
    if (existing) {
      const dialogue: Dialogue = { ...existing, speaker: data.speaker ?? existing.speaker, with: data.with ?? existing.with, content: data.content ?? existing.content, context: data.context ?? existing.context, chapterId: data.chapterId ?? existing.chapterId, seq: data.seq ?? existing.seq, updatedAt: time }
      saveDialogue(data.projectId, dialogue)
      return dialogue
    } else {
      const id = data.id || randomUUID()
      const dialogue: Dialogue = { id, projectId: data.projectId, speaker: data.speaker ?? '', with: data.with ?? '', content: data.content ?? '', context: data.context ?? '', chapterId: data.chapterId ?? '', seq: data.seq ?? 0, createdAt: time, updatedAt: time }
      saveDialogue(data.projectId, dialogue)
      return dialogue
    }
  })

  ipcMain.handle('dialogue:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      if (loadDialogues(project.id).find(d => d.id === id)) {
        deleteDialogue(project.id, id)
        break
      }
    }
    return { success: true }
  })
}



export function registerCharacterRelationHandlers(): void {
  ipcMain.handle('characterRelation:list', (_event, projectId: string) => {
    return loadCharacterRelations(projectId)
  })

  ipcMain.handle('characterRelation:save', (_event, data: Partial<CharacterRelation> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadCharacterRelations(data.projectId).find(r => r.id === data.id)
      if (!existing) return undefined
      const relation: CharacterRelation = {
        ...existing,
        characterId1: data.characterId1 ?? existing.characterId1,
        characterId2: data.characterId2 ?? existing.characterId2,
        relation: data.relation ?? existing.relation,
        description: data.description ?? existing.description,
        updatedAt: time
      }
      saveCharacterRelation(data.projectId, relation)

      // 同步保存到 MD 文件（需要所有关系数据和角色数据）
      if (project && project.path) {
        const allRelations = loadCharacterRelations(data.projectId)
        const characters = loadCharacters(data.projectId)
        saveCharacterRelationsMD(project.path, allRelations, characters)
      }

      return relation
    } else {
      const id = randomUUID()
      const relation: CharacterRelation = {
        id,
        projectId: data.projectId,
        characterId1: data.characterId1 ?? '',
        characterId2: data.characterId2 ?? '',
        relation: data.relation ?? '',
        description: data.description ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveCharacterRelation(data.projectId, relation)

      // 同步保存到 MD 文件
      if (project && project.path) {
        const allRelations = loadCharacterRelations(data.projectId)
        const characters = loadCharacters(data.projectId)
        saveCharacterRelationsMD(project.path, allRelations, characters)
      }

      return relation
    }
  })

  ipcMain.handle('characterRelation:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const relations = loadCharacterRelations(project.id)
      const relation = relations.find(r => r.id === id)
      if (relation) {
        deleteCharacterRelation(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allRelations = loadCharacterRelations(project.id)
          const characters = loadCharacters(project.id)
          saveCharacterRelationsMD(project.path, allRelations, characters)
        }
        break
      }
    }
    return { success: true }
  })

  // 角色关系图节点位置
  ipcMain.handle('characterPosition:list', (_event, projectId: string) => {
    return loadCharacterPositions(projectId)
  })

  ipcMain.handle('characterPosition:save', (_event, data: { projectId: string; positions: Record<string, { x: number; y: number }> }) => {
    return saveCharacterPositions(data.projectId, data.positions)
  })
}



export function registerInspirationHandlers(): void {
  ipcMain.handle('inspiration:list', (_event, projectId: string) => {
    return loadInspirations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('inspiration:save', (_event, data: Partial<Inspiration> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadInspirations(data.projectId).find(i => i.id === data.id)
      if (!existing) return undefined
      const inspiration: Inspiration = {
        ...existing,
        title: data.title ?? existing.title,
        content: data.content ?? existing.content,
        type: data.type ?? existing.type,
        source: data.source ?? existing.source,
        updatedAt: time
      }
      saveInspiration(data.projectId, inspiration)

      // 同步保存到 MD 文件（需要所有灵感数据）
      if (project && project.path && data.projectId) {
        const allInspirations = loadInspirations(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveInspirationsMD(project.path, allInspirations)
      }

      return inspiration
    } else {
      const id = randomUUID()
      const inspiration: Inspiration = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        content: data.content ?? '',
        type: data.type ?? '',
        source: data.source ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveInspiration(data.projectId, inspiration)

      // 同步保存到 MD 文件
      if (project && project.path && data.projectId) {
        const allInspirations = loadInspirations(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveInspirationsMD(project.path, allInspirations)
      }

      return inspiration
    }
  })

  ipcMain.handle('inspiration:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const inspirations = loadInspirations(project.id)
      const inspiration = inspirations.find(i => i.id === id)
      if (inspiration) {
        deleteInspiration(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allInspirations = loadInspirations(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveInspirationsMD(project.path, allInspirations)
        }
        break
      }
    }
    return { success: true }
  })
}



export function registerWritingLogHandlers(): void {
  ipcMain.handle('writingLog:list', (_event, projectId: string) => {
    return loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('writingLog:add', (_event, projectId: string, content: string) => {
    const id = randomUUID()
    const time = now()
    const project = loadProjectById(projectId)

    const log: WritingLog = {
      id,
      projectId,
      content,
      createdAt: time
    }
    saveWritingLog(projectId, log)

    // 同步保存到 MD 文件
    if (project && project.path) {
      const allLogs = loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      saveWritingLogsMD(project.path, allLogs)
    }

    return log
  })

  ipcMain.handle('writingLog:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const logs = loadWritingLogs(project.id)
      const log = logs.find(l => l.id === id)
      if (log) {
        deleteWritingLog(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allLogs = loadWritingLogs(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveWritingLogsMD(project.path, allLogs)
        }
        break
      }
    }
    return { success: true }
  })
}



export function registerReferenceHandlers(): void {
  ipcMain.handle('reference:list', (_event, projectId: string) => {
    return loadReferences(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  ipcMain.handle('reference:save', (_event, data: Partial<Reference> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    if (data.id) {
      const existing = loadReferences(data.projectId).find(r => r.id === data.id)
      if (!existing) return undefined
      const reference: Reference = {
        ...existing,
        title: data.title ?? existing.title,
        type: data.type ?? existing.type,
        url: data.url ?? existing.url,
        notes: data.notes ?? existing.notes,
        updatedAt: time
      }
      saveReference(data.projectId, reference)

      // 同步保存到 MD 文件（需要所有参考资料数据）
      if (project && project.path && data.projectId) {
        const allReferences = loadReferences(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveReferencesMD(project.path, allReferences)
      }

      return reference
    } else {
      const id = randomUUID()
      const reference: Reference = {
        id,
        projectId: data.projectId,
        title: data.title ?? '',
        type: data.type ?? '',
        url: data.url ?? '',
        notes: data.notes ?? '',
        createdAt: time,
        updatedAt: time
      }
      saveReference(data.projectId, reference)

      // 同步保存到 MD 文件
      if (project && project.path && data.projectId) {
        const allReferences = loadReferences(data.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        saveReferencesMD(project.path, allReferences)
      }

      return reference
    }
  })

  ipcMain.handle('reference:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const references = loadReferences(project.id)
      const reference = references.find(r => r.id === id)
      if (reference) {
        deleteReference(project.id, id)
        // 同步保存到 MD 文件
        if (project.path) {
          const allReferences = loadReferences(project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          saveReferencesMD(project.path, allReferences)
        }
        break
      }
    }
    return { success: true }
  })
}
