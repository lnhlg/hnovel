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



export function registerCharacterHandlers(): void {
  ipcMain.handle('character:list', (_event, projectId: string) => {
    return loadCharacters(projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })

  ipcMain.handle('character:save', (_event, data: Partial<Character> & { projectId: string }) => {
    const time = now()
    const project = loadProjectById(data.projectId)

    const existing = data.id ? loadCharacters(data.projectId).find(c => c.id === data.id) : null

    if (existing) {
      const character: Character = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        traits: data.traits ?? existing.traits,
        age: data.age ?? existing.age,
        appearance: data.appearance ?? existing.appearance,
        background: data.background ?? existing.background,
        personality: data.personality ?? existing.personality,
        role: data.role ?? existing.role,
        skills: data.skills ?? existing.skills,
        relationships: data.relationships ?? existing.relationships,
        motivation: data.motivation ?? existing.motivation,
        flaws: data.flaws ?? existing.flaws,
        growthArc: data.growthArc ?? existing.growthArc,
        gender: data.gender ?? existing.gender,
        dynasty: data.dynasty ?? existing.dynasty,
        birthplace: data.birthplace ?? existing.birthplace,
        heightBuild: data.heightBuild ?? existing.heightBuild,
        face: data.face ?? existing.face,
        hairstyle: data.hairstyle ?? existing.hairstyle,
        clothing: data.clothing ?? existing.clothing,
        talents: data.talents ?? existing.talents,
        likes: data.likes ?? existing.likes,
        importantEvents: data.importantEvents ?? existing.importantEvents,
        relationshipsDetail: data.relationshipsDetail ?? existing.relationshipsDetail,
        weaknesses: data.weaknesses ?? existing.weaknesses,
        specialMarks: data.specialMarks ?? existing.specialMarks,
        updatedAt: time
      }
      saveCharacter(data.projectId, character)

      // 同步保存到 MD 文件
      if (project && project.path) {
        if (data.name && data.name !== existing.name) {
          deleteCharacterMD(project.path, existing.name)
        }
        saveCharacterMD(project.path, character)
        saveCharactersMD(project.path, loadCharacters(data.projectId))
      }

      return character
    } else {
      // data.id 存在但未找到，或 data.id 不存在，都走新建分支
      const id = data.id || randomUUID()
      const character: Character = {
        id, projectId: data.projectId,
        name: data.name ?? '', description: data.description ?? '',
        traits: data.traits ?? '', age: data.age ?? 0,
        appearance: data.appearance ?? '', background: data.background ?? '',
        personality: data.personality ?? '', role: data.role ?? '',
        skills: data.skills ?? '', relationships: data.relationships ?? '',
        motivation: data.motivation ?? '', flaws: data.flaws ?? '',
        growthArc: data.growthArc ?? '',
        gender: data.gender ?? '', dynasty: data.dynasty ?? '',
        birthplace: data.birthplace ?? '', heightBuild: data.heightBuild ?? '',
        face: data.face ?? '', hairstyle: data.hairstyle ?? '',
        clothing: data.clothing ?? '', talents: data.talents ?? '',
        likes: data.likes ?? '', importantEvents: data.importantEvents ?? '',
        relationshipsDetail: data.relationshipsDetail ?? '',
        weaknesses: data.weaknesses ?? '', specialMarks: data.specialMarks ?? '',
        createdAt: time, updatedAt: time
      }
      saveCharacter(data.projectId, character)

      // 同步保存到 MD 文件
      if (project && project.path) {
        saveCharacterMD(project.path, character)
        saveCharactersMD(project.path, loadCharacters(data.projectId))
      }

      return character
    }
  })

  ipcMain.handle('character:delete', (_event, id: string) => {
    const allProjects = loadProjects()
    for (const project of allProjects) {
      const characters = loadCharacters(project.id)
      const character = characters.find(c => c.id === id)
      if (character) {
        deleteCharacter(project.id, id)
        // 同步删除 MD 文件
        if (project.path) {
          deleteCharacterMD(project.path, character.name)
          saveCharactersMD(project.path, loadCharacters(project.id))
        }
        break
      }
    }
    return { success: true }
  })
}
