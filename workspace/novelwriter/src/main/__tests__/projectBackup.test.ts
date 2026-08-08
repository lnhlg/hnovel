import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupProjectData } from '../projectBackup'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'novelwriter-backup-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(n => statSync(join(dir, n)).isDirectory())
}

describe('backupProjectData', () => {
  it('复制数据目录并返回备份路径', () => {
    const dataDir = join(root, 'data')
    const backupRoot = join(root, 'backups')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'chapters.json'), '{"ok":true}', 'utf-8')

    const target = backupProjectData(dataDir, backupRoot)
    expect(target).not.toBeNull()
    expect(existsSync(join(target as string, 'chapters.json'))).toBe(true)
    expect(listDirs(backupRoot)).toHaveLength(1)
  })

  it('同一自然日只备份一次', () => {
    const dataDir = join(root, 'data')
    const backupRoot = join(root, 'backups')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'chapters.json'), '{}', 'utf-8')

    expect(backupProjectData(dataDir, backupRoot)).not.toBeNull()
    expect(backupProjectData(dataDir, backupRoot)).toBeNull()
    expect(listDirs(backupRoot)).toHaveLength(1)
  })

  it('force=true 可强制再备份一份', () => {
    const dataDir = join(root, 'data')
    const backupRoot = join(root, 'backups')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'chapters.json'), '{}', 'utf-8')

    expect(backupProjectData(dataDir, backupRoot)).not.toBeNull()
    expect(backupProjectData(dataDir, backupRoot, 8, true)).not.toBeNull()
    expect(listDirs(backupRoot)).toHaveLength(2)
  })

  it('超过 keep 数量时清理最旧备份', () => {
    const dataDir = join(root, 'data')
    const backupRoot = join(root, 'backups')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'chapters.json'), '{}', 'utf-8')
    mkdirSync(backupRoot, { recursive: true })
    // 预置 10 份旧备份，按名字排序应只保留最新 8 份（含本次新建共 8 份）
    for (let i = 1; i <= 10; i++) {
      mkdirSync(join(backupRoot, `2026-01-${String(i).padStart(2, '0')}_000000`))
    }

    backupProjectData(dataDir, backupRoot, 8)
    const dirs = listDirs(backupRoot)
    expect(dirs).toHaveLength(8)
    expect(dirs).not.toContain('2026-01-01_000000')
    expect(dirs).not.toContain('2026-01-02_000000')
  })

  it('空数据目录不创建备份', () => {
    const dataDir = join(root, 'empty')
    const backupRoot = join(root, 'backups')
    mkdirSync(dataDir, { recursive: true })

    expect(backupProjectData(dataDir, backupRoot)).toBeNull()
    expect(existsSync(backupRoot)).toBe(false)
  })
})
