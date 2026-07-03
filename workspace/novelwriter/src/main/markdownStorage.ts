import { join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'fs'
import type { Project, Chapter, Character, WorldSetting, Timeline, Location, CharacterRelation, Inspiration, WritingLog, Reference } from './fileStorage'

// 目录结构
const DIRS = {
  characters: '角色',
  worldSettings: '世界观',
  chapters: '章节',
  timelines: '时间线',
  locations: '地点',
  characterRelations: '角色关系',
  inspirations: '灵感',
  references: '参考资料',
  writingLogs: '写作日志'
}

// 确保项目目录结构存在
export function ensureProjectDirs(projectPath: string): void {
  if (!projectPath) return

  // 如果项目根目录不存在，先创建
  if (!existsSync(projectPath)) {
    mkdirSync(projectPath, { recursive: true })
  }

  for (const dir of Object.values(DIRS)) {
    const fullPath = join(projectPath, dir)
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true })
    }
  }
}

// 安全的文件名（移除非法字符）
function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

// ===== 项目信息 =====

export function saveProjectMD(projectPath: string, project: Project): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const content = `# ${project.name}

> 创建时间：${new Date(project.createdAt).toLocaleString('zh-CN')}
> 更新时间：${new Date(project.updatedAt).toLocaleString('zh-CN')}

## 基本信息

- **题材**：${project.genre || '未设定'}
- **状态**：${project.status || '构思中'}
- **目标字数**：${project.wordCountTarget || 0}

## 简介

${project.synopsis || '暂无简介'}

## 世界观背景

${project.worldBackground || '暂无世界观背景'}

## 备注

${project.description || '暂无备注'}
`
  
  writeFileSync(join(projectPath, '项目信息.md'), content, 'utf-8')
}

export function readProjectMD(projectPath: string): Partial<Project> | null {
  if (!projectPath) return null
  const filePath = join(projectPath, '项目信息.md')
  if (!existsSync(filePath)) return null
  
  const content = readFileSync(filePath, 'utf-8')
  const nameMatch = content.match(/^#\s+(.+)/m)
  const genreMatch = content.match(/\*\*题材\*\*[：:]\s*(.+)/)
  const statusMatch = content.match(/\*\*状态\*\*[：:]\s*(.+)/)
  const wordCountMatch = content.match(/\*\*目标字数\*\*[：:]\s*(.+)/)
  const synopsisMatch = content.match(/## 简介\s*\n([\s\S]*?)(?=##|$)/)
  const worldMatch = content.match(/## 世界观背景\s*\n([\s\S]*?)(?=##|$)/)
  const descMatch = content.match(/## 备注\s*\n([\s\S]*?)(?=##|$)/)
  
  return {
    name: nameMatch?.[1]?.trim() || '',
    genre: genreMatch?.[1]?.trim() || '',
    status: statusMatch?.[1]?.trim() || '',
    wordCountTarget: parseInt(wordCountMatch?.[1]?.trim() || '0') || 0,
    synopsis: synopsisMatch?.[1]?.trim() || '',
    worldBackground: worldMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || ''
  }
}

export function readProjectContent(projectPath: string): string {
  const filePath = join(projectPath, '项目信息.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeProjectContent(projectPath: string, content: string): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  writeFileSync(join(projectPath, '项目信息.md'), content, 'utf-8')
}

// ===== 角色 =====

export function saveCharacterMD(projectPath: string, character: Character): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.characters)
  const fileName = safeFileName(character.name) + '.md'
  
  const content = `# ${character.name}

> 创建时间：${new Date(character.createdAt).toLocaleString('zh-CN')}
> 更新时间：${new Date(character.updatedAt).toLocaleString('zh-CN')}
> ID：${character.id}

## 基本信息

- **姓名**：${character.name}
- **性别**：${character.gender || '未设定'}
- **年龄**：${character.age || '未知'}
- **朝代**：${character.dynasty || '未设定'}
- **籍贯**：${character.birthplace || '未设定'}
- **角色定位**：${character.role || '未设定'}

## 身材

${character.heightBuild || '未设定'}

## 外貌特征

${['face', 'hairstyle', 'clothing'].map(k => {
  const v = character[k as keyof Character] as string
  const label = ({ face: '面容', hairstyle: '发型', clothing: '衣着' } as Record<string, string>)[k]
  return v ? `- **${label}**：${v}` : null
}).filter(Boolean).join('\n')}

${character.appearance ? `**外貌简述**：${character.appearance}` : ''}

## 性格特点

${character.personality || '暂无设定'}

${character.weaknesses ? `### 性格弱点\n\n${character.weaknesses}\n` : ''}
${character.traits ? `### 性格特征\n\n${character.traits}\n` : ''}
## 背景故事

${character.background || '暂无背景'}

${character.description ? `**简述**：${character.description}\n` : ''}
## 能力与才艺

${character.skills ? `**技能**：${character.skills}\n` : ''}
${character.talents ? `**才艺**：${character.talents}\n` : ''}
${character.likes ? `**喜好厌恶**：${character.likes}\n` : ''}
## 重要经历

${character.importantEvents || '暂无'}

## 人际关系

${character.relationships ? `**关系**：${character.relationships}\n` : ''}
${character.relationshipsDetail ? `**人际关系详情**：${character.relationshipsDetail}\n` : ''}
## 目标与动机

${character.motivation || '暂无'}

## 弱点缺陷

${character.flaws || '暂无'}

## 成长弧线

${character.growthArc || '暂无'}

${character.specialMarks ? `## 特殊标记\n\n${character.specialMarks}\n` : ''}`
  
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function readCharacterMD(filePath: string): Partial<Character> | null {
  if (!existsSync(filePath)) return null
  
  const content = readFileSync(filePath, 'utf-8')
  const nameMatch = content.match(/^#\s+(.+)/m)
  const idMatch = content.match(/ID[：:]\s*(.+)/)
  const roleMatch = content.match(/\*\*角色定位\*\*[：:]\s*(.+)/)
  const ageMatch = content.match(/\*\*年龄\*\*[：:]\s*(.+)/)
  const appearanceMatch = content.match(/## 外貌描写\s*\n([\s\S]*?)(?=##|$)/)
  const personalityMatch = content.match(/## 性格特点\s*\n([\s\S]*?)(?=##|$)/)
  const traitsMatch = content.match(/### 性格特征\s*\n([\s\S]*?)(?=##|$)/)
  const backgroundMatch = content.match(/## 背景故事\s*\n([\s\S]*?)(?=##|$)/)
  const descMatch = content.match(/## 简要描述\s*\n([\s\S]*?)(?=##|$)/)
  
  return {
    id: idMatch?.[1]?.trim() || '',
    name: nameMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || '',
    age: parseInt(ageMatch?.[1]?.trim() || '0') || 0,
    appearance: appearanceMatch?.[1]?.trim() || '',
    personality: personalityMatch?.[1]?.trim() || '',
    traits: traitsMatch?.[1]?.trim() || '',
    background: backgroundMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || ''
  }
}

export function listCharacterMDs(projectPath: string): string[] {
  if (!projectPath) return []
  const dir = join(projectPath, DIRS.characters)
  if (!existsSync(dir)) return []
  
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => join(dir, f))
}

export function deleteCharacterMD(projectPath: string, characterName: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.characters)
  const fileName = safeFileName(characterName) + '.md'
  const filePath = join(dir, fileName)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

// ===== 世界观设定 =====

export function saveWorldSettingMD(projectPath: string, setting: WorldSetting): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.worldSettings)
  const categoryDir = setting.category ? join(dir, safeFileName(setting.category)) : dir
  if (!existsSync(categoryDir)) {
    mkdirSync(categoryDir, { recursive: true })
  }
  
  const fileName = safeFileName(setting.key) + '.md'
  
  const content = `# ${setting.key}

> 创建时间：${new Date(setting.createdAt).toLocaleString('zh-CN')}
> 更新时间：${new Date(setting.updatedAt).toLocaleString('zh-CN')}
> ID：${setting.id}
> 分类：${setting.category || '未分类'}

## 核心设定

${setting.value || '暂无'}

## 详细说明

${setting.description || '暂无说明'}

## 规则体系

${setting.rules || '暂无'}

## 相关设定

${setting.relatedSettings || '暂无'}

## 对剧情的影响

${setting.plotImpact || '暂无'}

## 限制条件

${setting.limitations || '暂无'}

## 示例案例

${setting.examples || '暂无'}
`
  
  writeFileSync(join(categoryDir, fileName), content, 'utf-8')
}

export function deleteWorldSettingMD(projectPath: string, category: string, key: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.worldSettings)
  const categoryDir = category ? join(dir, safeFileName(category)) : dir
  const fileName = safeFileName(key) + '.md'
  const filePath = join(categoryDir, fileName)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

export function stripChapterTitle(title: string): string {
  return title.replace(/^(?:\d+\.[\s-]*|第\s*[一二三四五六七八九十百千\d]+\s*章\s*[·•.、．:\s-]*)+/, '').trim()
}

// ===== 章节 =====

export function saveChapterMD(projectPath: string, chapter: Chapter, index: number): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.chapters)
  const cleanTitle = stripChapterTitle(chapter.title)
  const fileName = `${index + 1}. ${safeFileName(cleanTitle || '无标题')}.md`

  const content = `# ${index + 1}. ${cleanTitle}

> 创建时间：${new Date(chapter.createdAt).toLocaleString('zh-CN')}
> 更新时间：${new Date(chapter.updatedAt).toLocaleString('zh-CN')}
> ID：${chapter.id}
> 状态：${chapter.status || '草稿'}
> 字数：${chapter.wordCount || 0}

## 本章概要

${chapter.outline || '暂无概要'}

## 正文内容

${chapter.content || '暂无内容'}
`
  
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function deleteChapterMD(projectPath: string, title: string, index: number): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.chapters)
  const fileName = `${index + 1}. ${safeFileName(stripChapterTitle(title) || '无标题')}.md`
  const filePath = join(dir, fileName)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

// ===== 时间线 =====

export function saveTimelineMD(projectPath: string, timelines: Timeline[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.timelines)
  const content = `# 时间线

> 本文件记录故事中的重要时间节点

---

${timelines.map((t, i) => `
## ${i + 1}. ${t.title}

- **时间**：${t.date || '未知'}
- **描述**：${t.description || '暂无描述'}
- **ID**：${t.id}

---
`).join('\n')}
`
  
  writeFileSync(join(dir, '时间线.md'), content, 'utf-8')
}

// ===== 地点 =====

export function saveLocationMD(projectPath: string, location: Location): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.locations)
  const fileName = safeFileName(location.name) + '.md'
  
  const content = `# ${location.name}

> 创建时间：${new Date(location.createdAt).toLocaleString('zh-CN')}
> 更新时间：${new Date(location.updatedAt).toLocaleString('zh-CN')}
> ID：${location.id}
> 类型：${location.type || '未分类'}

## 描述

${location.description || '暂无描述'}
`
  
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function deleteLocationMD(projectPath: string, name: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.locations)
  const fileName = safeFileName(name) + '.md'
  const filePath = join(dir, fileName)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

// ===== 角色关系 =====

export function saveCharacterRelationsMD(projectPath: string, relations: CharacterRelation[], characters: { id: string; name: string }[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const charMap = new Map<string, string>()
  characters.forEach(c => charMap.set(c.id, c.name))
  
  const dir = join(projectPath, DIRS.characterRelations)
  const content = `# 角色关系

> 本文件记录角色之间的关系网络

---

${relations.map((r, i) => `
## ${i + 1}. ${charMap.get(r.characterId1) || '未知'} ↔ ${charMap.get(r.characterId2) || '未知'}

- **关系类型**：${r.relation || '未设定'}
- **关系描述**：${r.description || '暂无描述'}
- **ID**：${r.id}

---
`).join('\n')}
`
  
  writeFileSync(join(dir, '角色关系.md'), content, 'utf-8')
}

// ===== 灵感 =====

export function saveInspirationsMD(projectPath: string, inspirations: Inspiration[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.inspirations)
  const content = `# 灵感记录

> 记录创作过程中的灵感火花

---

${inspirations.map((ins, i) => `
## ${i + 1}. ${ins.title}

- **类型**：${ins.type || '未分类'}
- **来源**：${ins.source || '未知'}
- **ID**：${ins.id}
- **创建时间**：${new Date(ins.createdAt).toLocaleString('zh-CN')}

### 内容

${ins.content || '暂无内容'}

---
`).join('\n')}
`
  
  writeFileSync(join(dir, '灵感记录.md'), content, 'utf-8')
}

// ===== 参考资料 =====

export function saveReferencesMD(projectPath: string, references: Reference[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.references)
  const content = `# 参考资料

> 收集与本项目相关的参考资料

---

${references.map((ref, i) => `
## ${i + 1}. ${ref.title}

- **类型**：${ref.type || '未分类'}
- **链接**：${ref.url || '无'}
- **ID**：${ref.id}
- **备注**：${ref.notes || '暂无备注'}

---
`).join('\n')}
`
  
  writeFileSync(join(dir, '参考资料.md'), content, 'utf-8')
}

// ===== 写作日志 =====

export function saveWritingLogsMD(projectPath: string, logs: WritingLog[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  const dir = join(projectPath, DIRS.writingLogs)
  const content = `# 写作日志

> 记录写作过程中的思考与感悟

---

${logs.map((log, i) => `
## ${new Date(log.createdAt).toLocaleString('zh-CN')}

${log.content}

---
`).join('\n')}
`
  
  writeFileSync(join(dir, '写作日志.md'), content, 'utf-8')
}

// ===== 批量保存整个项目 =====

export function saveAllProjectDataMD(
  projectPath: string,
  project: Project,
  chapters: Chapter[],
  characters: Character[],
  worldSettings: WorldSetting[],
  timelines: Timeline[],
  locations: Location[],
  characterRelations: CharacterRelation[],
  inspirations: Inspiration[],
  references: Reference[],
  writingLogs: WritingLog[]
): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)
  
  saveProjectMD(projectPath, project)
  
  chapters.forEach((ch, i) => saveChapterMD(projectPath, ch, i))
  
  characters.forEach(c => saveCharacterMD(projectPath, c))
  
  worldSettings.forEach(s => saveWorldSettingMD(projectPath, s))
  
  saveTimelineMD(projectPath, timelines)
  
  locations.forEach(l => saveLocationMD(projectPath, l))
  
  saveCharacterRelationsMD(projectPath, characterRelations, characters.map(c => ({ id: c.id, name: c.name })))
  
  saveInspirationsMD(projectPath, inspirations)
  
  saveReferencesMD(projectPath, references)
  
  saveWritingLogsMD(projectPath, writingLogs)
}

// ===== 通用文档内容读写 =====

export function readCharacterContent(projectPath: string, characterName: string): string {
  const dir = join(projectPath, DIRS.characters)
  const fileName = safeFileName(characterName) + '.md'
  const filePath = join(dir, fileName)
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeCharacterContent(projectPath: string, characterName: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.characters)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const fileName = safeFileName(characterName) + '.md'
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function readChapterContent(projectPath: string, index: number, title: string): string {
  const dir = join(projectPath, DIRS.chapters)
  const fileName = `${index + 1}. ${safeFileName(stripChapterTitle(title) || '无标题')}.md`
  const filePath = join(dir, fileName)
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeChapterContent(projectPath: string, index: number, title: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.chapters)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const fileName = `${index + 1}. ${safeFileName(stripChapterTitle(title) || '无标题')}.md`
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function readWorldSettingContent(projectPath: string, category: string, key: string): string {
  const dir = join(projectPath, DIRS.worldSettings)
  const categoryDir = category ? join(dir, safeFileName(category)) : dir
  const fileName = safeFileName(key) + '.md'
  const filePath = join(categoryDir, fileName)
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeWorldSettingContent(projectPath: string, category: string, key: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.worldSettings)
  const categoryDir = category ? join(dir, safeFileName(category)) : dir
  if (!existsSync(categoryDir)) mkdirSync(categoryDir, { recursive: true })
  const fileName = safeFileName(key) + '.md'
  writeFileSync(join(categoryDir, fileName), content, 'utf-8')
}

export function readLocationContent(projectPath: string, name: string): string {
  const dir = join(projectPath, DIRS.locations)
  const fileName = safeFileName(name) + '.md'
  const filePath = join(dir, fileName)
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeLocationContent(projectPath: string, name: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.locations)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const fileName = safeFileName(name) + '.md'
  writeFileSync(join(dir, fileName), content, 'utf-8')
}

export function readTimelineContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.timelines, '时间线.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeTimelineContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.timelines)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '时间线.md'), content, 'utf-8')
}

export function readCharacterRelationsContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.characterRelations, '角色关系.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeCharacterRelationsContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.characterRelations)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '角色关系.md'), content, 'utf-8')
}

export function readInspirationsContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.inspirations, '灵感记录.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeInspirationsContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.inspirations)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '灵感记录.md'), content, 'utf-8')
}

export function readReferencesContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.references, '参考资料.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeReferencesContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.references)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '参考资料.md'), content, 'utf-8')
}

export function readWritingLogsContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.writingLogs, '写作日志.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeWritingLogsContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.writingLogs)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '写作日志.md'), content, 'utf-8')
}

// ===== 角色聚合文档 =====

export function saveCharactersMD(projectPath: string, characters: Character[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)

  const dir = join(projectPath, DIRS.characters)
  const content = `# 角色设定

> 本文件列出所有登场角色的概览信息，点击单个角色可查看详细档案

---

${characters.map((c, i) => `
## ${i + 1}. ${c.name}

- **定位**：${c.role || '未设定'}
- **性别**：${c.gender || '未设定'}
- **年龄**：${c.age > 0 ? c.age + '岁' : '未设定'}
- **朝代**：${c.dynasty || '未设定'}
- **籍贯**：${c.birthplace || '未设定'}
- **特征**：${c.traits || '暂无'}
- **简介**：${c.description || '暂无描述'}
- **ID**：${c.id}

---
`).join('\n')}
`

  writeFileSync(join(dir, '角色设定.md'), content, 'utf-8')
}

export function readCharactersContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.characters, '角色设定.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeCharactersContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.characters)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '角色设定.md'), content, 'utf-8')
}

/** 从聚合角色 MD 中解析角色列表 */
export function parseCharactersFromMD(content: string): Array<{ id: string; name: string; role: string; age: number; traits: string; description: string }> {
  const results: Array<{ id: string; name: string; role: string; age: number; traits: string; description: string }> = []
  const lines = content.split('\n')
  let buf: { id: string; name: string; role: string; age: number; traits: string; description: string } | null = null

  for (const line of lines) {
    const nameMatch = line.match(/^##\s+\d+\.\s*(.+)/)
    if (nameMatch) {
      if (buf) results.push(buf)
      buf = { id: '', name: nameMatch[1].trim(), role: '', age: 0, traits: '', description: '' }
      continue
    }
    if (!buf) continue
    const roleMatch = line.match(/- \*\*定位\*\*[：:]\s*(.+)/)
    if (roleMatch) { buf.role = roleMatch[1].trim(); continue }
    const ageMatch = line.match(/- \*\*年龄\*\*[：:]\s*(.+)/)
    if (ageMatch) { buf.age = parseInt(ageMatch[1].trim()) || 0; continue }
    const traitsMatch = line.match(/- \*\*特征\*\*[：:]\s*(.+)/)
    if (traitsMatch) { buf.traits = traitsMatch[1].trim(); continue }
    const descMatch = line.match(/- \*\*简介\*\*[：:]\s*(.+)/)
    if (descMatch) { buf.description = descMatch[1].trim(); continue }
    const idMatch = line.match(/- \*\*ID\*\*[：:]\s*(.+)/)
    if (idMatch) buf.id = idMatch[1].trim()
  }
  if (buf) results.push(buf)
  return results
}

// ===== 世界观聚合文档 =====

export function saveWorldSettingsMD(projectPath: string, settings: WorldSetting[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)

  const categories = [...new Set(settings.map(s => s.category || '未分类'))]
  const dir = join(projectPath, DIRS.worldSettings)

  const content = `# 世界观设定

> 本文件记录世界的各项设定规则与背景

---

${categories.map(cat => `
## ${cat}

${settings
  .filter(s => (s.category || '未分类') === cat)
  .map(s => `
### ${s.key}

- **值**：${s.value || '未设定'}
- **说明**：${s.description || '暂无'}
- **ID**：${s.id}

`)
  .join('\n')}

---
`).join('\n')}
`

  writeFileSync(join(dir, '世界观设定.md'), content, 'utf-8')
}

/** 从聚合世界观 MD 中解析设定列表 */
export function parseWorldSettingsFromMD(content: string): Array<{ id: string; key: string; category: string; value: string; description: string }> {
  const results: Array<{ id: string; key: string; category: string; value: string; description: string }> = []
  const lines = content.split('\n')
  let currentCategory = ''
  let buf: { id: string; key: string; category: string; value: string; description: string } | null = null

  for (const line of lines) {
    const catMatch = line.match(/^##\s+(.+)/)
    if (catMatch) {
      if (buf) results.push(buf)
      buf = null
      currentCategory = catMatch[1].trim()
      continue
    }
    const keyMatch = line.match(/^###\s+(.+)/)
    if (keyMatch) {
      if (buf) results.push(buf)
      buf = { id: '', key: keyMatch[1].trim(), category: currentCategory, value: '', description: '' }
      continue
    }
    if (!buf) continue
    const valMatch = line.match(/- \*\*值\*\*[：:]\s*(.+)/)
    if (valMatch) { buf.value = valMatch[1].trim(); continue }
    const descMatch = line.match(/- \*\*说明\*\*[：:]\s*(.+)/)
    if (descMatch) { buf.description = descMatch[1].trim(); continue }
    const idMatch = line.match(/- \*\*ID\*\*[：:]\s*(.+)/)
    if (idMatch) buf.id = idMatch[1].trim()
  }
  if (buf) results.push(buf)
  return results
}

export function readWorldSettingsContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.worldSettings, '世界观设定.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeWorldSettingsContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.worldSettings)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '世界观设定.md'), content, 'utf-8')
}

// ===== 地点聚合文档 =====

export function saveLocationsMD(projectPath: string, locations: Location[]): void {
  if (!projectPath) return
  ensureProjectDirs(projectPath)

  const types = [...new Set(locations.map(l => l.type || '未分类'))]
  const dir = join(projectPath, DIRS.locations)

  const content = `# 地点场景

> 本文件记录故事中的重要地点与场景

---

${types.map(type => `
## ${type}

${locations
  .filter(l => (l.type || '未分类') === type)
  .map(l => `
### ${l.name}

- **描述**：${l.description || '暂无描述'}
- **ID**：${l.id}

`)
  .join('\n')}

---
`).join('\n')}
`

  writeFileSync(join(dir, '地点场景.md'), content, 'utf-8')
}

/** 从聚合地点 MD 中解析地点列表 */
export function parseLocationsFromMD(content: string): Array<{ id: string; name: string; type: string; description: string }> {
  const results: Array<{ id: string; name: string; type: string; description: string }> = []
  const lines = content.split('\n')
  let currentType = ''
  let buf: { id: string; name: string; type: string; description: string } | null = null

  for (const line of lines) {
    const typeMatch = line.match(/^##\s+(.+)/)
    if (typeMatch) {
      if (buf) results.push(buf)
      buf = null
      currentType = typeMatch[1].trim()
      continue
    }
    const nameMatch = line.match(/^###\s+(.+)/)
    if (nameMatch) {
      if (buf) results.push(buf)
      buf = { id: '', name: nameMatch[1].trim(), type: currentType, description: '' }
      continue
    }
    if (!buf) continue
    const descMatch = line.match(/- \*\*描述\*\*[：:]\s*(.+)/)
    if (descMatch) { buf.description = descMatch[1].trim(); continue }
    const idMatch = line.match(/- \*\*ID\*\*[：:]\s*(.+)/)
    if (idMatch) buf.id = idMatch[1].trim()
  }
  if (buf) results.push(buf)
  return results
}

export function readLocationsContent(projectPath: string): string {
  const filePath = join(projectPath, DIRS.locations, '地点场景.md')
  if (!existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8')
}

export function writeLocationsContent(projectPath: string, content: string): void {
  if (!projectPath) return
  const dir = join(projectPath, DIRS.locations)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '地点场景.md'), content, 'utf-8')
}