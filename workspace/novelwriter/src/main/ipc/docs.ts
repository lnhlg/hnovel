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
import { parseCharacterFromContent } from './assets'



// ===== 文档内容读取/保存（以 Markdown 原文形式） =====

type DocType = 'project' | 'chapter' | 'character' | 'characters' | 'worldSetting' | 'worldSettings' | 'timeline' | 'location' | 'locations' | 'characterRelations' | 'inspirations' | 'references' | 'writingLogs'



export function registerDocHandlers(): void {
  ipcMain.handle('doc:read', async (_event, projectId: string, docType: DocType, entityId: string) => {
    const project = loadProjectById(projectId)
    if (!project || !project.path) {
      throw new Error('项目不存在或项目路径未设置')
    }
    const projectPath = project.path

    switch (docType) {
      case 'project': {
        const content = readProjectContent(projectPath)
        if (!content && project) {
          saveProjectMD(projectPath, project)
          return readProjectContent(projectPath)
        }
        return content
      }
      case 'chapter': {
        const chapters = loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const chapter = chapters.find(c => c.id === entityId)
        if (!chapter) return ''
        const index = chapters.findIndex((c) => c.id === entityId)
        const content = readChapterContent(projectPath, index, chapter.title)
        if (!content) {
          saveChapterMD(projectPath, chapter, index)
          return readChapterContent(projectPath, index, chapter.title)
        }
        return content
      }
      case 'characters': {
        const characters = loadCharacters(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readCharactersContent(projectPath)
        if (!content && characters.length > 0) {
          saveCharactersMD(projectPath, characters)
          return readCharactersContent(projectPath)
        }
        return content
      }
      case 'character': {
        const character = loadCharacters(projectId).find(c => c.id === entityId)
        if (!character) return ''
        const content = readCharacterContent(projectPath, character.name)
        if (!content) {
          saveCharacterMD(projectPath, character)
          return readCharacterContent(projectPath, character.name)
        }
        return content
      }
      case 'worldSettings': {
        const settings = loadWorldSettings(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readWorldSettingsContent(projectPath)
        if (!content && settings.length > 0) {
          saveWorldSettingsMD(projectPath, settings)
          return readWorldSettingsContent(projectPath)
        }
        return content
      }
      case 'worldSetting': {
        const setting = loadWorldSettings(projectId).find(s => s.id === entityId)
        if (!setting) return ''
        const content = readWorldSettingContent(projectPath, setting.category, setting.key)
        if (!content) {
          saveWorldSettingMD(projectPath, setting)
          return readWorldSettingContent(projectPath, setting.category, setting.key)
        }
        return content
      }
      case 'locations': {
        const locations = loadLocations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readLocationsContent(projectPath)
        if (!content && locations.length > 0) {
          saveLocationsMD(projectPath, locations)
          return readLocationsContent(projectPath)
        }
        return content
      }
      case 'location': {
        const location = loadLocations(projectId).find(l => l.id === entityId)
        if (!location) return ''
        const content = readLocationContent(projectPath, location.name)
        if (!content) {
          saveLocationMD(projectPath, location)
          return readLocationContent(projectPath, location.name)
        }
        return content
      }
      case 'timeline': {
        const timelines = loadTimelines(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const content = readTimelineContent(projectPath)
        if (!content && timelines.length > 0) {
          saveTimelineMD(projectPath, timelines)
          return readTimelineContent(projectPath)
        }
        return content
      }
      case 'characterRelations': {
        const relations = loadCharacterRelations(projectId)
        const characters = loadCharacters(projectId)
        const content = readCharacterRelationsContent(projectPath)
        if (!content && relations.length > 0) {
          saveCharacterRelationsMD(projectPath, relations, characters)
          return readCharacterRelationsContent(projectPath)
        }
        return content
      }
      case 'inspirations': {
        const inspirations = loadInspirations(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readInspirationsContent(projectPath)
        if (!content && inspirations.length > 0) {
          saveInspirationsMD(projectPath, inspirations)
          return readInspirationsContent(projectPath)
        }
        return content
      }
      case 'references': {
        const references = loadReferences(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readReferencesContent(projectPath)
        if (!content && references.length > 0) {
          saveReferencesMD(projectPath, references)
          return readReferencesContent(projectPath)
        }
        return content
      }
      case 'writingLogs': {
        const logs = loadWritingLogs(projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const content = readWritingLogsContent(projectPath)
        if (!content && logs.length > 0) {
          saveWritingLogsMD(projectPath, logs)
          return readWritingLogsContent(projectPath)
        }
        return content
      }
      default:
        return ''
    }
  })

  ipcMain.handle('doc:save', async (_event, projectId: string, docType: DocType, entityId: string, content: string) => {
    const project = loadProjectById(projectId)
    if (!project || !project.path) {
      throw new Error('项目不存在或项目路径未设置')
    }
    const projectPath = project.path
    const time = now()

    switch (docType) {
      case 'project': {
        writeProjectContent(projectPath, content)
        const parsed = readProjectMD(projectPath)
        if (parsed && parsed.name) {
          project.name = parsed.name
          project.description = parsed.description ?? project.description
          project.synopsis = parsed.synopsis ?? project.synopsis
          project.genre = parsed.genre ?? project.genre
          project.status = parsed.status ?? project.status
          project.wordCountTarget = parsed.wordCountTarget ?? project.wordCountTarget
          project.worldBackground = parsed.worldBackground ?? project.worldBackground
          project.updatedAt = time
          saveProject(project)
        }
        return { success: true }
      }
      case 'chapter': {
        const chapters = loadChapters(projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        const chapter = chapters.find(c => c.id === entityId)
        if (!chapter) return { success: false }
        const index = chapters.findIndex((c) => c.id === entityId)

        const titleMatch = content.match(/^#\s+(.+)/m)
        const outlineMatch = content.match(/## 本章概要\r?\n([\s\S]*?)(?=\r?\n## |\r?\n$)/)
        const contentMatch = content.match(/## 正文内容\r?\n([\s\S]*?)$/)

        const newOutline = outlineMatch?.[1]?.trim() || ''
        let newContent = contentMatch?.[1]?.trim() || ''
        // 修复旧 bug：正文区域嵌套了完整文档时，提取最里层正文
        const nestedContentIdx = newContent.indexOf('## 正文内容')
        if (nestedContentIdx !== -1) {
          newContent = newContent.substring(nestedContentIdx + 7).trim()
        }

        let rawTitle = titleMatch?.[1]?.trim() || chapter.title
        // 优先使用正文区域起始的章节标题（如"第1章 惊变"）
        const bodyTitle = extractTitleFromBody(newContent)
        if (bodyTitle) rawTitle = bodyTitle
        const newTitle = rawTitle

        const oldTitle = stripChapterTitle(chapter.title)
        const oldFileName = `${index + 1}. ${oldTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
        const newFileName = `${index + 1}. ${newTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
        if (oldFileName !== newFileName) {
          const oldPath = join(projectPath, '章节', oldFileName)
          if (existsSync(oldPath)) unlinkSync(oldPath)
        }

        writeChapterContent(projectPath, index, newTitle, content)

        chapter.title = newTitle
        chapter.content = newContent
        chapter.outline = newOutline
        chapter.wordCount = newContent.length
        chapter.updatedAt = time
        saveChapter(projectId, chapter)
        return { success: true, newTitle }
      }
      case 'character': {
        const character = loadCharacters(projectId).find(c => c.id === entityId)
        if (!character) return { success: false }

        const parsed = parseCharacterFromContent(content)
        const newName = parsed.name || character.name

        if (newName !== character.name) {
          deleteCharacterMD(projectPath, character.name)
        }

        writeCharacterContent(projectPath, newName, content)

        character.name = newName
        character.description = parsed.description ?? character.description
        character.traits = parsed.traits ?? character.traits
        character.age = parsed.age ?? character.age
        character.appearance = parsed.appearance ?? character.appearance
        character.background = parsed.background ?? character.background
        character.personality = parsed.personality ?? character.personality
        character.role = parsed.role ?? character.role
        character.updatedAt = time
        saveCharacter(projectId, character)
        return { success: true, newName }
      }
      case 'worldSetting': {
        const setting = loadWorldSettings(projectId).find(s => s.id === entityId)
        if (!setting) return { success: false }

        const catMatch = content.match(/分类[：:]\s*(.+)/)
        const nameMatch = content.match(/^#\s+(.+)/m)
        const valueMatch = content.match(/## 核心内容\s*\n([\s\S]*?)(?=##|$)/)
        const descMatch = content.match(/## 详细说明\s*\n([\s\S]*?)$/)

        const newCategory = catMatch?.[1]?.trim() || setting.category
        const newKey = nameMatch?.[1]?.trim() || setting.key
        const newValue = valueMatch?.[1]?.trim() || ''
        const newDesc = descMatch?.[1]?.trim() || ''

        if (newCategory !== setting.category || newKey !== setting.key) {
          deleteWorldSettingMD(projectPath, setting.category, setting.key)
        }

        writeWorldSettingContent(projectPath, newCategory, newKey, content)

        setting.category = newCategory
        setting.key = newKey
        setting.value = newValue
        setting.description = newDesc
        setting.updatedAt = time
        saveWorldSetting(projectId, setting)
        return { success: true, newKey, newCategory }
      }
      case 'location': {
        const location = loadLocations(projectId).find(l => l.id === entityId)
        if (!location) return { success: false }

        const nameMatch = content.match(/^#\s+(.+)/m)
        const typeMatch = content.match(/类型[：:]\s*(.+)/)
        const descMatch = content.match(/## 描述\s*\n([\s\S]*?)$/)

        const newName = nameMatch?.[1]?.trim() || location.name
        const newType = typeMatch?.[1]?.trim() || ''
        const newDesc = descMatch?.[1]?.trim() || ''

        if (newName !== location.name) {
          deleteLocationMD(projectPath, location.name)
        }

        writeLocationContent(projectPath, newName, content)

        location.name = newName
        location.description = newDesc
        location.type = newType
        location.updatedAt = time
        saveLocation(projectId, location)
        return { success: true, newName }
      }
      case 'locations': {
        writeLocationsContent(projectPath, content)
        const parsedLocations = parseLocationsFromMD(content)
        for (const p of parsedLocations) {
          const existing = loadLocations(projectId).find(l => l.id === p.id)
          if (existing) {
            existing.name = p.name || existing.name
            existing.type = p.type || existing.type
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveLocation(projectId, existing)
          } else if (p.id) {
            saveLocation(projectId, {
              id: p.id,
              projectId,
              name: p.name || '',
              type: p.type || '',
              description: p.description || '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      case 'characters': {
        writeCharactersContent(projectPath, content)
        const parsedChars = parseCharactersFromMD(content)
        for (const p of parsedChars) {
          const existing = loadCharacters(projectId).find(c => c.id === p.id)
          if (existing) {
            existing.name = p.name || existing.name
            existing.role = p.role || existing.role
            existing.age = p.age || existing.age
            existing.traits = p.traits || existing.traits
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveCharacter(projectId, existing)
          } else if (p.id) {
            saveCharacter(projectId, {
              id: p.id,
              projectId,
              name: p.name || '',
              role: p.role || '',
              age: p.age || 0,
              traits: p.traits || '',
              description: p.description || '',
              appearance: '',
              background: '',
              personality: '',
              skills: '',
              relationships: '',
              motivation: '',
              flaws: '',
              growthArc: '',
              gender: '',
              dynasty: '',
              birthplace: '',
              heightBuild: '',
              face: '',
              hairstyle: '',
              clothing: '',
              talents: '',
              likes: '',
              importantEvents: '',
              relationshipsDetail: '',
              weaknesses: '',
              specialMarks: '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      case 'worldSettings': {
        writeWorldSettingsContent(projectPath, content)
        const parsedSettings = parseWorldSettingsFromMD(content)
        for (const p of parsedSettings) {
          const existing = loadWorldSettings(projectId).find(s => s.id === p.id)
          if (existing) {
            existing.key = p.key || existing.key
            existing.category = p.category || existing.category
            existing.value = p.value || existing.value
            existing.description = p.description || existing.description
            existing.updatedAt = time
            saveWorldSetting(projectId, existing)
          } else if (p.id) {
            saveWorldSetting(projectId, {
              id: p.id,
              projectId,
              key: p.key || '',
              category: p.category || '',
              value: p.value || '',
              description: p.description || '',
              rules: '',
              relatedSettings: '',
              plotImpact: '',
              limitations: '',
              examples: '',
              createdAt: time,
              updatedAt: time
            })
          }
        }
        return { success: true }
      }
      default:
        return { success: false, message: '该文档类型暂不支持从 MD 同步到数据库' }
    }
  })
}
