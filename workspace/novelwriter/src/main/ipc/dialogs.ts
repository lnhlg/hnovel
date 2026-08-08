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



export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:open', async (event, options: Electron.OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(window, options)
  })

  ipcMain.handle('dialog:save', async (event, options: Electron.SaveDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePath: '' }
    return dialog.showSaveDialog(window, options)
  })

  ipcMain.handle('dialog:select-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    const result = await dialog.showOpenDialog(window, {
      title: '选择项目文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    return result
  })

  // 读取文件内容（用于章节大纲/正文导入）
  ipcMain.handle('file:readText', async (event, filePath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, content: '' }
    try {
      const { readFileSync } = await import('fs')
      const content = readFileSync(filePath, 'utf-8')
      return { canceled: false, content }
    } catch (err) {
      console.error('读取文件失败:', err)
      return { canceled: true, content: '', error: err instanceof Error ? err.message : String(err) }
    }
  })
}
