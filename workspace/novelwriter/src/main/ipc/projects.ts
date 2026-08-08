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



export function registerProjectHandlers(): void {
  ipcMain.handle('project:create', (_event, name: string) => {
    const id = randomUUID()
    const time = now()
    const project: Project = {
      id, name, description: '', synopsis: '', path: '', genre: '',
      wordCountTarget: 0, status: '构思中', worldBackground: '',
      storyProgress: '',
      writingStyleId: '',
      skillId: '',
      createdAt: time, updatedAt: time
    }
    saveProject(project)
    return project
  })

  ipcMain.handle('project:createWithPath', (_event, name: string, folderPath: string) => {
    const id = randomUUID()
    const time = now()
    // 在选中的文件夹下创建一个以项目名命名的子目录
    const projectDir = join(folderPath, name.replace(/[<>:"/\\|?*]/g, '_'))
    try {
      mkdirSync(projectDir, { recursive: true })
    } catch (err) {
      console.error('创建项目文件夹失败:', err)
      throw new Error('无法创建项目文件夹，请检查权限')
    }
    const project: Project = {
      id, name, description: '', synopsis: '', path: projectDir, genre: '',
      wordCountTarget: 0, status: '构思中', worldBackground: '',
      storyProgress: '',
      writingStyleId: '',
      skillId: '',
      createdAt: time, updatedAt: time
    }
    saveProject(project)
    return project
  })

  ipcMain.handle('project:open', (_event, projectId: string) => {
    return loadProjectById(projectId)
  })

  ipcMain.handle('project:list', () => {
    return loadProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })

  ipcMain.handle('project:openFromFolder', async (_event, folderPath: string) => {
    // 验证是否是合法项目文件夹
    const novelwriterDir = join(folderPath, '.novelwriter')
    const chaptersDir = join(folderPath, '章节')
    if (!existsSync(novelwriterDir) || !existsSync(chaptersDir)) {
      throw new Error('非合法项目文件夹：缺少必要的项目文件结构')
    }
    // 检查是否已存在同名项目
    const name = folderPath.split(/[/\\]/).pop() || ''
    const existing = loadProjects().find(p => p.path === folderPath)
    if (existing) return existing
    // 创建新项目
    const id = randomUUID()
    const time = now()
    const project: Project = {
      id, name, description: '', synopsis: '', path: folderPath, genre: '',
      wordCountTarget: 0, status: '构思中', worldBackground: '',
      storyProgress: '', writingStyleId: '', skillId: '',
      createdAt: time, updatedAt: time
    }
    saveProject(project)
    return project
  })

  ipcMain.handle('project:save', (_event, data: Partial<Project> & { id: string }) => {
    const time = now()
    const existing = loadProjectById(data.id)
    if (!existing) return undefined
    const project: Project = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      synopsis: data.synopsis ?? existing.synopsis,
      path: data.path ?? existing.path,
      genre: data.genre ?? existing.genre,
      wordCountTarget: data.wordCountTarget ?? existing.wordCountTarget,
      status: data.status ?? existing.status,
      worldBackground: data.worldBackground ?? existing.worldBackground,
      writingStyleId: data.writingStyleId ?? existing.writingStyleId,
      skillId: data.skillId ?? existing.skillId,
      updatedAt: time
    }
    saveProject(project)

    // 同步保存到 MD 文件
    if (project.path) {
      saveProjectMD(project.path, project)
    }

    return project
  })

  ipcMain.handle('project:delete', async (_event, id: string) => {
    await deleteProject(id)
    return { success: true }
  })
}
