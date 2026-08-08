import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { dirname } from 'path'

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// 原子写入：先写临时文件再 rename 覆盖，进程中断/崩溃时不会写坏原文件
export function atomicWriteFile(path: string, content: string): void {
  ensureDir(dirname(path))
  const tmpPath = `${path}.${Date.now()}.tmp`
  try {
    writeFileSync(tmpPath, content, 'utf-8')
    renameSync(tmpPath, path)
  } catch (err) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch { /* ignore */ }
    throw err
  }
}

export function atomicWriteJson(path: string, data: unknown): void {
  atomicWriteFile(path, JSON.stringify(data, null, 2))
}
