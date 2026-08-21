import { app, shell, safeStorage } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync, copyFileSync, unlinkSync } from 'fs'
import { atomicWriteJson } from './atomicWrite'
import { backupProjectData } from './projectBackup'
import { readChapterContent } from './markdownStorage'
import type { Foreshadow } from './indexStore'

// ===================== 类型定义 =====================

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
  // 详细角色模板字段
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
  rules: string
  relatedSettings: string
  plotImpact: string
  limitations: string
  examples: string
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
  chapterId: string
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
  updatedAt: string
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

export interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'ollama'
  baseUrl: string
  apiKey: string
  model: string
  isActive: number
  createdAt: string
  updatedAt: string
}

// ===================== 存储路径 =====================

const APP_DIR = join(app.getPath('userData'), 'novelwriter')
const PROJECTS_FILE = join(APP_DIR, 'projects.json')
const AI_PROVIDERS_FILE = join(APP_DIR, 'aiProviders.json')
// 出厂默认文风/技能（随应用分发，只读；打包后位于 asar 内）
const WRITING_STYLES_DEFAULT_FILE = join(app.getAppPath(), 'writing-styles', 'styles.json')
const SKILLS_DEFAULT_FILE = join(app.getAppPath(), 'skills', 'skills.json')
// 用户可编辑的文风/技能（存 userData，打包后仍可写）
const WRITING_STYLES_FILE = join(APP_DIR, 'writing-styles.json')
const SKILLS_FILE = join(APP_DIR, 'skills.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// 清理原子写入崩溃残留的临时文件（*.tmp），仅限启动阶段调用
function cleanupTmpFiles(dir: string): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      cleanupTmpFiles(full)
    } else if (entry.isFile() && entry.name.endsWith('.tmp')) {
      try { unlinkSync(full) } catch { /* ignore */ }
    }
  }
}

// 记录本进程内已备份过的损坏文件，避免重复备份刷屏
const backedUpCorruptFiles = new Set<string>()

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch (err) {
    // 解析失败时保留损坏文件副本，便于人工恢复数据
    if (!backedUpCorruptFiles.has(path)) {
      backedUpCorruptFiles.add(path)
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupPath = `${path}.${stamp}.corrupt.bak`
        copyFileSync(path, backupPath)
        console.error(`[storage] JSON 解析失败，已备份到: ${backupPath}`, err)
      } catch (backupErr) {
        console.error('[storage] JSON 解析失败且备份失败:', path, backupErr)
      }
    }
    return undefined
  }
}

function writeJson(path: string, data: unknown): void {
  atomicWriteJson(path, data)
}

/** 获取项目数据目录：有 path 用项目目录，否则用全局目录 */
function getProjectDataDir(project: Project): string {
  if (project.path) {
    const dir = join(project.path, '.novelwriter')
    ensureDir(dir)
    return dir
  }
  const dir = join(APP_DIR, 'data', project.id)
  ensureDir(dir)
  return dir
}

/** 备份目录：有 path 的项目备份到项目目录下的 .novelwriter-backups，否则放全局 backups/{projectId} */
function getProjectBackupRoot(project: Project): string {
  return project.path ? join(project.path, '.novelwriter-backups') : join(APP_DIR, 'backups', project.id)
}

function getProjectDataDirById(projectId: string): string | null {
  const project = loadProjectById(projectId)
  if (!project) return null
  return getProjectDataDir(project)
}

function entityPath(projectId: string, entityFile: string): string | null {
  const dir = getProjectDataDirById(projectId)
  if (!dir) return null
  return join(dir, entityFile)
}

// ===================== 通用 CRUD =====================

class JsonStore<T extends { id: string }> {
  private filePath: string

  constructor(filePath: string | null) {
    if (!filePath) throw new Error('Invalid file path for JsonStore')
    this.filePath = filePath
  }

  load(): T[] {
    const data = readJson<T[]>(this.filePath) ?? []
    return data
  }

  save(items: T[]): void {
    writeJson(this.filePath, items)
  }

  findOne(id: string): T | undefined {
    return this.load().find(i => i.id === id)
  }

  findAll(filter?: (item: T) => boolean): T[] {
    const items = this.load()
    return filter ? items.filter(filter) : items
  }

  upsert(item: T): T {
    const items = this.load()
    const idx = items.findIndex(i => i.id === item.id)
    if (idx >= 0) {
      items[idx] = item
    } else {
      items.push(item)
    }
    this.save(items)
    return item
  }

  delete(id: string): void {
    const items = this.load().filter(i => i.id !== id)
    this.save(items)
  }

  deleteAll(filter: (item: T) => boolean): void {
    const items = this.load().filter(i => !filter(i))
    this.save(items)
  }
}

function storeFor<T extends { id: string }>(projectId: string, file: string): JsonStore<T> {
  const path = entityPath(projectId, file)
  if (!path) throw new Error(`Cannot create store for project ${projectId}`)
  return new JsonStore<T>(path)
}

// ===================== 项目操作 =====================

export function loadProjects(): Project[] {
  return readJson<Project[]>(PROJECTS_FILE) ?? []
}

export function saveProjects(projects: Project[]): void {
  ensureDir(APP_DIR)
  writeJson(PROJECTS_FILE, projects)
}

export function loadProjectById(id: string): Project | undefined {
  return loadProjects().find(p => p.id === id)
}

export function saveProject(project: Project): Project {
  const projects = loadProjects()
  const idx = projects.findIndex(p => p.id === project.id)
  if (idx >= 0) {
    projects[idx] = project
  } else {
    projects.push(project)
  }
  saveProjects(projects)
  return project
}

export async function deleteProject(id: string): Promise<void> {
  const project = loadProjectById(id)
  if (project) {
    // 删除项目数据目录
    const dataDir = getProjectDataDir(project)
    if (existsSync(dataDir)) {
      try {
        // 优先移入系统回收站，误删可恢复；失败时退回直接删除
        await shell.trashItem(dataDir)
      } catch {
        try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* ignore */ }
      }
    }
  }
  saveProjects(loadProjects().filter(p => p.id !== id))
}

// ===================== 实体操作 =====================

function chapterContentPath(projectId: string, chapterId: string): string | null {
  const dir = getProjectDataDirById(projectId)
  return dir ? join(dir, 'chapters', `${chapterId}.json`) : null
}

function readChapterContentFile(projectId: string, chapterId: string): string {
  const path = chapterContentPath(projectId, chapterId)
  if (!path || !existsSync(path)) return ''
  return readJson<{ content?: string }>(path)?.content ?? ''
}

export function loadChapters(projectId: string): Chapter[] {
  const items = storeFor<Chapter>(projectId, 'chapters.json').load()
  const project = loadProjectById(projectId)
  // 正文事实源：有项目路径的项目从书稿目录 MD 读取；无路径项目回退按章 JSON 文件
  const mergeContent = (c: Chapter): Chapter => {
    if (project?.path) {
      return { ...c, content: readChapterContent(project.path, c.sortOrder, c.title) }
    }
    return { ...c, content: readChapterContentFile(projectId, c.id) }
  }
  const needsMigration = items.some(c => c.content)
  if (needsMigration) {
    // 旧版把全部章节正文存在 chapters.json 里；迁移为按章独立文件，索引只保留元数据
    const dir = getProjectDataDirById(projectId)
    if (dir) {
      // 迁移前做一次全量数据快照，迁移失败时可整体回滚
      const project = loadProjectById(projectId)
      if (project) {
        backupProjectData(dir, getProjectBackupRoot(project), 8, true)
      }
      const contentDir = join(dir, 'chapters')
      ensureDir(contentDir)
      const migrated = items.map(c => {
        if (c.content) {
          writeJson(join(contentDir, `${c.id}.json`), { content: c.content })
          return { ...c, content: '' }
        }
        return c
      })
      const indexPath = entityPath(projectId, 'chapters.json')
      if (indexPath && existsSync(indexPath)) {
        try {
          copyFileSync(indexPath, `${indexPath}.migrated-${Date.now()}.bak`)
        } catch { /* ignore */ }
      }
      writeJson(join(dir, 'chapters.json'), migrated)
      return migrated.map(mergeContent)
    }
  }
  return items.map(mergeContent)
}

export function saveChapter(projectId: string, chapter: Chapter): Chapter {
  const content = chapter.content ?? ''
  const project = loadProjectById(projectId)
  // 有项目路径时正文只写书稿目录 MD（由 saveChapterWithMd 负责），JSON 不再存正文；
  // 无路径项目仍写按章 JSON 文件
  if (!project?.path) {
    const path = chapterContentPath(projectId, chapter.id)
    if (path) {
      ensureDir(dirname(path))
      writeJson(path, { content })
    }
  }
  const saved = storeFor<Chapter>(projectId, 'chapters.json').upsert({ ...chapter, content: '' })
  return { ...saved, content }
}

export function deleteChapter(projectId: string, id: string): void {
  storeFor<Chapter>(projectId, 'chapters.json').delete(id)
  const path = chapterContentPath(projectId, id)
  if (path && existsSync(path)) {
    try { unlinkSync(path) } catch { /* ignore */ }
  }
}

export function loadCharacters(projectId: string): Character[] {
  return storeFor<Character>(projectId, 'characters.json').load()
}

export function saveCharacter(projectId: string, character: Character): Character {
  return storeFor<Character>(projectId, 'characters.json').upsert(character)
}

export function deleteCharacter(projectId: string, id: string): void {
  storeFor<Character>(projectId, 'characters.json').delete(id)
}

export function loadWorldSettings(projectId: string): WorldSetting[] {
  return storeFor<WorldSetting>(projectId, 'worldSettings.json').load()
}

export function saveWorldSetting(projectId: string, setting: WorldSetting): WorldSetting {
  return storeFor<WorldSetting>(projectId, 'worldSettings.json').upsert(setting)
}

export function deleteWorldSetting(projectId: string, id: string): void {
  storeFor<WorldSetting>(projectId, 'worldSettings.json').delete(id)
}

export function loadTimelines(projectId: string): Timeline[] {
  return storeFor<Timeline>(projectId, 'timelines.json').load()
}

export function saveTimeline(projectId: string, timeline: Timeline): Timeline {
  return storeFor<Timeline>(projectId, 'timelines.json').upsert(timeline)
}

export function deleteTimeline(projectId: string, id: string): void {
  storeFor<Timeline>(projectId, 'timelines.json').delete(id)
}

export function loadLocations(projectId: string): Location[] {
  return storeFor<Location>(projectId, 'locations.json').load()
}

export function saveLocation(projectId: string, location: Location): Location {
  return storeFor<Location>(projectId, 'locations.json').upsert(location)
}

export function deleteLocation(projectId: string, id: string): void {
  storeFor<Location>(projectId, 'locations.json').delete(id)
}

export function loadItems(projectId: string): Item[] {
  return storeFor<Item>(projectId, 'items.json').load()
}

export function saveItem(projectId: string, item: Item): Item {
  return storeFor<Item>(projectId, 'items.json').upsert(item)
}

export function deleteItem(projectId: string, id: string): void {
  storeFor<Item>(projectId, 'items.json').delete(id)
}

export function loadDialogues(projectId: string): Dialogue[] {
  return storeFor<Dialogue>(projectId, 'dialogues.json').load()
}

export function saveDialogue(projectId: string, dialogue: Dialogue): Dialogue {
  return storeFor<Dialogue>(projectId, 'dialogues.json').upsert(dialogue)
}

export function deleteDialogue(projectId: string, id: string): void {
  storeFor<Dialogue>(projectId, 'dialogues.json').delete(id)
}

export function loadCharacterRelations(projectId: string): CharacterRelation[] {
  return storeFor<CharacterRelation>(projectId, 'characterRelations.json').load()
}

export function saveCharacterRelation(projectId: string, relation: CharacterRelation): CharacterRelation {
  return storeFor<CharacterRelation>(projectId, 'characterRelations.json').upsert(relation)
}

export function deleteCharacterRelation(projectId: string, id: string): void {
  storeFor<CharacterRelation>(projectId, 'characterRelations.json').delete(id)
}

// 角色关系图节点位置：{ [characterId]: { x, y } }
export type CharacterPositions = Record<string, { x: number; y: number }>

export function loadCharacterPositions(projectId: string): CharacterPositions {
  const path = entityPath(projectId, 'characterPositions.json')
  if (!path) return {}
  return readJson<CharacterPositions>(path) ?? {}
}

export function saveCharacterPositions(projectId: string, positions: CharacterPositions): CharacterPositions {
  const path = entityPath(projectId, 'characterPositions.json')
  if (!path) return positions
  writeJson(path, positions)
  return positions
}

export function loadInspirations(projectId: string): Inspiration[] {
  return storeFor<Inspiration>(projectId, 'inspirations.json').load()
}

export function saveInspiration(projectId: string, inspiration: Inspiration): Inspiration {
  return storeFor<Inspiration>(projectId, 'inspirations.json').upsert(inspiration)
}

export function deleteInspiration(projectId: string, id: string): void {
  storeFor<Inspiration>(projectId, 'inspirations.json').delete(id)
}

export function loadWritingLogs(projectId: string): WritingLog[] {
  return storeFor<WritingLog>(projectId, 'writingLogs.json').load()
}

export function saveWritingLog(projectId: string, log: WritingLog): WritingLog {
  return storeFor<WritingLog>(projectId, 'writingLogs.json').upsert(log)
}

export function deleteWritingLog(projectId: string, id: string): void {
  storeFor<WritingLog>(projectId, 'writingLogs.json').delete(id)
}

export function loadReferences(projectId: string): Reference[] {
  return storeFor<Reference>(projectId, 'references.json').load()
}

export function saveReference(projectId: string, reference: Reference): Reference {
  return storeFor<Reference>(projectId, 'references.json').upsert(reference)
}

export function deleteReference(projectId: string, id: string): void {
  storeFor<Reference>(projectId, 'references.json').delete(id)
}

// ===================== 伏笔线（持久化到 JSON，index.db 仅作查询缓存） =====================

export function hasForeshadowRecords(projectId: string): boolean {
  const path = entityPath(projectId, 'foreshadows.json')
  return !!path && existsSync(path)
}

export function loadForeshadowRecords(projectId: string): Foreshadow[] {
  return storeFor<Foreshadow>(projectId, 'foreshadows.json').load()
}

export function saveForeshadowRecord(projectId: string, f: Foreshadow): Foreshadow {
  return storeFor<Foreshadow>(projectId, 'foreshadows.json').upsert(f)
}

export function deleteForeshadowRecord(projectId: string, id: string): void {
  storeFor<Foreshadow>(projectId, 'foreshadows.json').delete(id)
}

// ===================== 写作风格（全局） =====================

export function loadWritingStyles(): WritingStyle[] {
  const userStyles = readJson<WritingStyle[]>(WRITING_STYLES_FILE)
  if (userStyles) return userStyles
  // 用户文件尚未初始化时回退到应用自带的默认文风
  return readJson<WritingStyle[]>(WRITING_STYLES_DEFAULT_FILE) ?? []
}

export function saveWritingStyle(style: WritingStyle): WritingStyle {
  const styles = loadWritingStyles()
  const idx = styles.findIndex(s => s.id === style.id)
  if (idx >= 0) {
    styles[idx] = style
  } else {
    styles.push(style)
  }
  writeJson(WRITING_STYLES_FILE, styles)
  return style
}

export function deleteWritingStyle(id: string): void {
  const styles = loadWritingStyles().filter(s => s.id !== id)
  writeJson(WRITING_STYLES_FILE, styles)
}

export function getNextWritingStyleSortOrder(): number {
  const styles = loadWritingStyles()
  return styles.length > 0 ? Math.max(...styles.map(s => s.sortOrder)) + 1 : 0
}

// ===================== 技能（全局） =====================

export function loadSkills(): Skill[] {
  const userSkills = readJson<Skill[]>(SKILLS_FILE)
  if (userSkills) return userSkills
  // 用户文件尚未初始化时回退到应用自带的默认技能
  return readJson<Skill[]>(SKILLS_DEFAULT_FILE) ?? []
}

export function saveSkill(skill: Skill): Skill {
  const skills = loadSkills()
  const idx = skills.findIndex(s => s.id === skill.id)
  if (idx >= 0) {
    skills[idx] = skill
  } else {
    skills.push(skill)
  }
  writeJson(SKILLS_FILE, skills)
  return skill
}

export function deleteSkill(id: string): void {
  const skills = loadSkills().filter(s => s.id !== id)
  writeJson(SKILLS_FILE, skills)
}

export function getNextSkillSortOrder(): number {
  const skills = loadSkills()
  return skills.length > 0 ? Math.max(...skills.map(s => s.sortOrder)) + 1 : 0
}

// ===================== 故事进展 =====================

export function loadStoryProgress(projectId: string): string {
  const project = loadProjectById(projectId)
  return project?.storyProgress ?? ''
}

export function saveStoryProgress(projectId: string, storyProgress: string): void {
  const project = loadProjectById(projectId)
  if (!project) return
  project.storyProgress = storyProgress
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

// ===================== AI 供应商操作 =====================

// apiKey 落盘加密：safeStorage 可用时存 enc:<base64>，不可用（如无钥匙环的 Linux）回退明文。
// 加密只在"磁盘上"发生；读入内存后仍为明文供请求使用，行为与之前一致。
const API_KEY_PREFIX = 'enc:'

function encryptApiKey(plain: string): string {
  if (!plain || plain.startsWith(API_KEY_PREFIX)) return plain
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return API_KEY_PREFIX + safeStorage.encryptString(plain).toString('base64')
    }
  } catch (err) {
    console.error('[storage] apiKey 加密失败，回退明文存储:', err)
  }
  return plain
}

function decryptApiKey(stored: string): string {
  if (!stored || !stored.startsWith(API_KEY_PREFIX)) return stored
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(stored.slice(API_KEY_PREFIX.length), 'base64'))
    }
  } catch (err) {
    console.error('[storage] apiKey 解密失败（返回空，请重新填写）:', err)
  }
  return ''
}

export function loadAIProviders(): AIProvider[] {
  const providers = readJson<AIProvider[]>(AI_PROVIDERS_FILE) ?? []
  return providers.map(p => ({ ...p, apiKey: decryptApiKey(p.apiKey ?? '') }))
}

export function saveAIProvider(provider: AIProvider): AIProvider {
  const providers = loadAIProviders()
  const idx = providers.findIndex(p => p.id === provider.id)
  const toSave = { ...provider, apiKey: encryptApiKey(provider.apiKey ?? '') }
  if (idx >= 0) {
    providers[idx] = toSave
  } else {
    providers.push(toSave)
  }
  ensureDir(APP_DIR)
  writeJson(AI_PROVIDERS_FILE, providers)
  return provider
}

export function deleteAIProvider(id: string): void {
  const providers = loadAIProviders().filter(p => p.id !== id)
  ensureDir(APP_DIR)
  writeJson(AI_PROVIDERS_FILE, providers)
}

// ===================== 初始化 =====================

export async function initStorage(): Promise<void> {
  ensureDir(APP_DIR)
  // 清理原子写入崩溃残留的临时文件
  cleanupTmpFiles(APP_DIR)
  for (const project of loadProjects()) {
    if (project.path) cleanupTmpFiles(join(project.path, '.novelwriter'))
  }
  // 确保全局文件存在
  if (!existsSync(PROJECTS_FILE)) writeJson(PROJECTS_FILE, [])
  if (!existsSync(AI_PROVIDERS_FILE)) writeJson(AI_PROVIDERS_FILE, [])
  // 首次启动时把应用自带的默认文风/技能复制到 userData，
  // 之后用户编辑只写 userData，安装目录不再作为可写存储
  if (!existsSync(WRITING_STYLES_FILE)) {
    if (existsSync(WRITING_STYLES_DEFAULT_FILE)) {
      copyFileSync(WRITING_STYLES_DEFAULT_FILE, WRITING_STYLES_FILE)
    } else {
      writeJson(WRITING_STYLES_FILE, [])
    }
  }
  if (!existsSync(SKILLS_FILE)) {
    if (existsSync(SKILLS_DEFAULT_FILE)) {
      copyFileSync(SKILLS_DEFAULT_FILE, SKILLS_FILE)
    } else {
      writeJson(SKILLS_FILE, [])
    }
  }
  // 每日自动备份各项目数据目录（同一自然日只备份一次，保留最近 8 份）
  for (const project of loadProjects()) {
    const dataDir = project.path ? join(project.path, '.novelwriter') : join(APP_DIR, 'data', project.id)
    backupProjectData(dataDir, getProjectBackupRoot(project))
  }
}
