import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openIndex, saveIndex, rebuildSearchIndex, searchIndex, listForeshadows, saveForeshadow, deleteForeshadow } from '../indexStore'
import { collectIndexableDocs } from '../indexDocs'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'novelwriter-index-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('indexStore', () => {
  it('重建索引后可搜索标题与正文，并生成摘要', async () => {
    const dbPath = join(root, 'index.db')
    const db = await openIndex(dbPath)
    rebuildSearchIndex(db, [
      { docId: 'ch1', kind: '章节', title: '第一章 惊变', body: '假山之下埋着一条密道，黄蓉发现了它。', chapterOrder: 1 }
    ])
    saveIndex(db, dbPath)
    db.close()

    const db2 = await openIndex(dbPath)
    const hits = searchIndex(db2, '密道')
    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('第一章 惊变')
    expect(hits[0].snippet).toContain('密道')
    db2.close()
  })

  it('支持按 kind 过滤', async () => {
    const db = await openIndex(join(root, 'index.db'))
    rebuildSearchIndex(db, [
      { docId: 'c1', kind: '章节', title: '第一章', body: '郭靖练功', chapterOrder: 1 },
      { docId: 'r1', kind: '角色', title: '黄蓉', body: '郭靖之妻，聪慧过人', chapterOrder: 0 }
    ])
    const hits = searchIndex(db, '郭靖', { kinds: ['角色'] })
    expect(hits).toHaveLength(1)
    expect(hits[0].kind).toBe('角色')
    db.close()
  })

  it('伏笔线可增删改查并持久化', async () => {
    const dbPath = join(root, 'index.db')
    const db = await openIndex(dbPath)
    const now = new Date().toISOString()
    saveForeshadow(db, {
      id: 'f1',
      title: '假山密道',
      status: 'active',
      chapterId: 'ch36',
      marker: '[伏笔:假山密道]',
      notes: '通往城外',
      createdAt: now,
      updatedAt: now
    })
    saveIndex(db, dbPath)
    db.close()

    const db2 = await openIndex(dbPath)
    const list = listForeshadows(db2)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('假山密道')
    expect(list[0].status).toBe('active')

    deleteForeshadow(db2, 'f1')
    saveIndex(db2, dbPath)
    db2.close()

    const db3 = await openIndex(dbPath)
    expect(listForeshadows(db3)).toHaveLength(0)
    db3.close()
  })
})

describe('collectIndexableDocs', () => {
  it('扫描书稿目录 MD 并跳过 .novelwriter', () => {
    const project = join(root, 'project')
    mkdirSync(join(project, '章节'), { recursive: true })
    mkdirSync(join(project, '角色'), { recursive: true })
    mkdirSync(join(project, '.novelwriter'), { recursive: true })
    writeFileSync(join(project, '章节', '1. 惊变.md'), '正文', 'utf-8')
    writeFileSync(join(project, '角色', '黄蓉.md'), '角色卡', 'utf-8')
    writeFileSync(join(project, '.novelwriter', 'index.db'), 'skip', 'utf-8')

    const docs = collectIndexableDocs(project)
    expect(docs).toHaveLength(2)
    const chapter = docs.find(d => d.docId === join('章节', '1. 惊变.md'))
    expect(chapter?.kind).toBe('章节')
    expect(chapter?.chapterOrder).toBe(1)
    expect(docs.some(d => d.docId.includes('.novelwriter'))).toBe(false)
  })
})
