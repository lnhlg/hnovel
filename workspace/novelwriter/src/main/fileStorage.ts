import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs'

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
const WRITING_STYLES_DIR = join(app.getAppPath(), 'writing-styles')
const WRITING_STYLES_FILE = join(WRITING_STYLES_DIR, 'styles.json')
const SKILLS_DIR = join(app.getAppPath(), 'skills')
const SKILLS_FILE = join(SKILLS_DIR, 'skills.json')

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return undefined
  }
}

function writeJson(path: string, data: unknown): void {
  ensureDir(join(path, '..'))
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
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

export function deleteProject(id: string): void {
  const project = loadProjectById(id)
  if (project) {
    // 删除项目数据目录
    const dataDir = getProjectDataDir(project)
    if (existsSync(dataDir)) {
      try { rmSync(dataDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
  saveProjects(loadProjects().filter(p => p.id !== id))
}

// ===================== 实体操作 =====================

export function loadChapters(projectId: string): Chapter[] {
  return storeFor<Chapter>(projectId, 'chapters.json').load()
}

export function saveChapter(projectId: string, chapter: Chapter): Chapter {
  return storeFor<Chapter>(projectId, 'chapters.json').upsert(chapter)
}

export function deleteChapter(projectId: string, id: string): void {
  storeFor<Chapter>(projectId, 'chapters.json').delete(id)
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

// ===================== 写作风格（全局） =====================

export function loadWritingStyles(): WritingStyle[] {
  return readJson<WritingStyle[]>(WRITING_STYLES_FILE) ?? []
}

export function saveWritingStyle(style: WritingStyle): WritingStyle {
  const styles = loadWritingStyles()
  const idx = styles.findIndex(s => s.id === style.id)
  if (idx >= 0) {
    styles[idx] = style
  } else {
    styles.push(style)
  }
  ensureDir(WRITING_STYLES_DIR)
  writeJson(WRITING_STYLES_FILE, styles)
  return style
}

export function deleteWritingStyle(id: string): void {
  const styles = loadWritingStyles().filter(s => s.id !== id)
  ensureDir(WRITING_STYLES_DIR)
  writeJson(WRITING_STYLES_FILE, styles)
}

export function getNextWritingStyleSortOrder(): number {
  const styles = loadWritingStyles()
  return styles.length > 0 ? Math.max(...styles.map(s => s.sortOrder)) + 1 : 0
}

// ===================== 技能（全局） =====================

export function loadSkills(): Skill[] {
  return readJson<Skill[]>(SKILLS_FILE) ?? []
}

export function saveSkill(skill: Skill): Skill {
  const skills = loadSkills()
  const idx = skills.findIndex(s => s.id === skill.id)
  if (idx >= 0) {
    skills[idx] = skill
  } else {
    skills.push(skill)
  }
  ensureDir(SKILLS_DIR)
  writeJson(SKILLS_FILE, skills)
  return skill
}

export function deleteSkill(id: string): void {
  const skills = loadSkills().filter(s => s.id !== id)
  ensureDir(SKILLS_DIR)
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

export function loadAIProviders(): AIProvider[] {
  return readJson<AIProvider[]>(AI_PROVIDERS_FILE) ?? []
}

export function saveAIProvider(provider: AIProvider): AIProvider {
  const providers = loadAIProviders()
  const idx = providers.findIndex(p => p.id === provider.id)
  if (idx >= 0) {
    providers[idx] = provider
  } else {
    providers.push(provider)
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
  // 确保全局文件存在
  if (!existsSync(PROJECTS_FILE)) writeJson(PROJECTS_FILE, [])
  if (!existsSync(AI_PROVIDERS_FILE)) writeJson(AI_PROVIDERS_FILE, [])
  ensureDir(WRITING_STYLES_DIR)
  if (!existsSync(WRITING_STYLES_FILE)) writeJson(WRITING_STYLES_FILE, [])
  ensureDir(SKILLS_DIR)
  if (!existsSync(SKILLS_FILE)) writeJson(SKILLS_FILE, [])
}
