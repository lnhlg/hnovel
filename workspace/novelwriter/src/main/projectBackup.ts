import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'

const DEFAULT_KEEP = 8

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function timestamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}`
}

function listBackupDirs(root: string): string[] {
  try {
    return readdirSync(root).filter(name => {
      try {
        return statSync(join(root, name)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

// 只保留最新的 keep 份备份
function pruneBackups(root: string, keep: number): void {
  const dirs = listBackupDirs(root).sort().reverse()
  for (const name of dirs.slice(keep)) {
    try {
      rmSync(join(root, name), { recursive: true, force: true })
    } catch { /* ignore */ }
  }
}

/**
 * 把项目数据目录（.novelwriter）整体复制到备份目录。
 * 同一自然日只备份一次；返回本次备份路径，未执行时返回 null。
 */
export function backupProjectData(dataDir: string, backupRoot: string, keep = DEFAULT_KEEP, force = false): string | null {
  if (!existsSync(dataDir)) return null
  try {
    if (readdirSync(dataDir).length === 0) return null
  } catch {
    return null
  }
  mkdirSync(backupRoot, { recursive: true })

  const stamp = timestamp()
  const dayPrefix = stamp.slice(0, 10)
  if (!force && listBackupDirs(backupRoot).some(name => name.startsWith(dayPrefix))) {
    return null // 今天已备份过
  }

  let target = join(backupRoot, stamp)
  let suffix = 2
  while (existsSync(target)) {
    target = join(backupRoot, `${stamp}-${suffix}`)
    suffix++
  }
  cpSync(dataDir, target, { recursive: true })
  pruneBackups(backupRoot, keep)
  return target
}
