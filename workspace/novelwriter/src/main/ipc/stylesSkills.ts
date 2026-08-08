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



// ===== 写作风格 =====

export function registerWritingStyleHandlers(): void {
  ipcMain.handle('writingStyle:list', () => {
    return loadWritingStyles().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('writingStyle:save', (_event, data: Partial<WritingStyle>) => {
    const time = now()

    if (data.id) {
      const existing = loadWritingStyles().find(s => s.id === data.id)
      if (!existing) return undefined
      const style: WritingStyle = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        instructions: data.instructions ?? existing.instructions,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    } else {
      const id = randomUUID()
      const sortOrder = getNextWritingStyleSortOrder()
      const style: WritingStyle = {
        id,
        projectId: '',
        name: data.name ?? '',
        description: data.description ?? '',
        instructions: data.instructions ?? '',
        sortOrder,
        createdAt: time,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    }
  })

  ipcMain.handle('writingStyle:delete', (_event, id: string) => {
    deleteWritingStyle(id)
    return { success: true }
  })
}



// ===== 技能 =====

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', () => {
    return loadSkills().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('skill:save', (_event, data: Partial<Skill>) => {
    const time = now()
    if (data.id) {
      const existing = loadSkills().find(s => s.id === data.id)
      if (!existing) return undefined
      const skill: Skill = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        content: data.content ?? existing.content,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveSkill(skill)
      return skill
    } else {
      const id = randomUUID()
      const sortOrder = getNextSkillSortOrder()
      const skill: Skill = {
        id, name: data.name ?? '', description: data.description ?? '',
        category: data.category ?? '', content: data.content ?? '',
        sortOrder, createdAt: time, updatedAt: time
      }
      saveSkill(skill)
      return skill
    }
  })

  ipcMain.handle('skill:delete', (_event, id: string) => {
    deleteSkill(id)
    return { success: true }
  })
}
