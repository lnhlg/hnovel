import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { atomicWriteFile } from '../atomicWrite'
import { stripChapterTitle, parseCharactersFromMD, parseWorldSettingsFromMD, parseLocationsFromMD, saveChapterMD, normalizeChapterMD } from '../markdownStorage'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'novelwriter-storage-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('stripChapterTitle', () => {
  it('去除中文章节编号前缀', () => {
    expect(stripChapterTitle('第一章 惊变')).toBe('惊变')
    expect(stripChapterTitle('第3章·风起')).toBe('风起')
  })

  it('去除数字与英文章节前缀', () => {
    expect(stripChapterTitle('1. 标题')).toBe('标题')
    expect(stripChapterTitle('Chapter 3: 名字')).toBe('名字')
  })

  it('无编号时保持原样', () => {
    expect(stripChapterTitle('无编号标题')).toBe('无编号标题')
  })
})

describe('parseCharactersFromMD', () => {
  const md = `# 角色设定

> 说明

---

## 1. 林晚

- **ID**：char-1
- **定位**：主角
- **年龄**：18
- **特征**：冷静、果决
- **简介**：出身武学世家的少女

## 2. 顾沉

- **ID**：char-2
- **定位**：反派
- **年龄**：35
- **特征**：阴沉
- **简介**：幕后黑手
`

  it('解析出全部角色与字段', () => {
    const chars = parseCharactersFromMD(md)
    expect(chars).toHaveLength(2)
    expect(chars[0]).toMatchObject({
      id: 'char-1',
      name: '林晚',
      role: '主角',
      age: 18,
      traits: '冷静、果决',
      description: '出身武学世家的少女'
    })
    expect(chars[1].name).toBe('顾沉')
  })
})

describe('parseWorldSettingsFromMD', () => {
  const md = `# 世界观设定

## 力量体系

### 灵气

- **ID**：ws-1
- **值**：天地元气
- **说明**：可被修士吸纳
`

  it('解析分类、名称与字段', () => {
    const settings = parseWorldSettingsFromMD(md)
    expect(settings).toHaveLength(1)
    expect(settings[0]).toMatchObject({
      id: 'ws-1',
      key: '灵气',
      category: '力量体系',
      value: '天地元气',
      description: '可被修士吸纳'
    })
  })
})

describe('parseLocationsFromMD', () => {
  const md = `# 地点场景

## 城市

### 临安城

- **ID**：loc-1
- **描述**：江南首府
`

  it('解析地点类型与描述', () => {
    const locations = parseLocationsFromMD(md)
    expect(locations).toHaveLength(1)
    expect(locations[0]).toMatchObject({
      id: 'loc-1',
      name: '临安城',
      type: '城市',
      description: '江南首府'
    })
  })
})

describe('atomicWriteFile', () => {
  it('写入、覆盖且不残留临时文件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'novelwriter-atomic-'))
    const file = join(dir, 'test.json')
    try {
      atomicWriteFile(file, '{"a":1}')
      expect(readFileSync(file, 'utf-8')).toBe('{"a":1}')

      atomicWriteFile(file, '{"a":2}')
      expect(readFileSync(file, 'utf-8')).toBe('{"a":2}')

      const leftovers = readdirSync(dir).filter(f => f.endsWith('.tmp'))
      expect(leftovers).toHaveLength(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('saveChapterMD / normalizeChapterMD', () => {
  const chapter = {
    id: 'c1',
    projectId: 'p1',
    title: '第一章 测试',
    content: '# 第一章 测试\n\n## 本章概要\n\n原始章纲\n\n## 正文内容\n\n第一段正文',
    outline: '章纲A',
    sortOrder: 0,
    wordCount: 0,
    status: '草稿',
    draftVersion: 1,
    storyProgressSynced: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  it('saveChapterMD 不重复嵌入章纲与标题', () => {
    const projectPath = join(root, 'proj-save')
    mkdirSync(projectPath, { recursive: true })
    saveChapterMD(projectPath, chapter, 0)
    const md = readFileSync(join(projectPath, '章节', '1. 测试.md'), 'utf-8')
    expect((md.match(/## 本章概要/g) || []).length).toBe(1)
    expect((md.match(/## 正文内容/g) || []).length).toBe(1)
    expect(md).toContain('章纲A')
    expect(md).toContain('第一段正文')
  })

  it('normalizeChapterMD 消除历史重复文件', () => {
    const projectPath = join(root, 'proj-normalize')
    mkdirSync(join(projectPath, '章节'), { recursive: true })
    const duplicated = `# 1. 测试

> 创建时间：2026
> 更新时间：2026
> ID：c1
> 状态：草稿
> 字数：0

## 本章概要

章纲A

## 正文内容

# 第一章 测试

> 更新时间：2026

## 本章概要

章纲A

## 正文内容

第一段正文
`
    writeFileSync(join(projectPath, '章节', '1. 测试.md'), duplicated, 'utf-8')

    normalizeChapterMD(projectPath, chapter, 0)
    const md = readFileSync(join(projectPath, '章节', '1. 测试.md'), 'utf-8')
    expect((md.match(/## 本章概要/g) || []).length).toBe(1)
    expect((md.match(/## 正文内容/g) || []).length).toBe(1)
    expect(md).toContain('第一段正文')
    expect(md).toContain('章纲A')
  })
})
