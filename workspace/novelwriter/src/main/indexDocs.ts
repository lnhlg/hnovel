import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, basename, dirname } from 'path'

export interface IndexedDoc {
  docId: string
  kind: string
  title: string
  body: string
  chapterOrder: number
}

const SKIP_DIRS = new Set(['.novelwriter', '.novelwriter-backups', '.arts', '.codeartsdoer', 'node_modules', '.git'])

function collectDir(projectPath: string, dir: string, out: IndexedDoc[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectDir(projectPath, full, out)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const rel = relative(projectPath, full)
      const kind = basename(dirname(full))
      const title = basename(full, '.md')
      const orderMatch = title.match(/^(\d+)[.\s-_]/)
      let body = ''
      try {
        body = readFileSync(full, 'utf-8')
      } catch { /* ignore unreadable */ }
      out.push({
        docId: rel,
        kind,
        title,
        body,
        chapterOrder: orderMatch ? parseInt(orderMatch[1], 10) : 0
      })
    }
  }
}

/** 扫描书稿目录下全部 Markdown 文件作为索引文档（跳过 .novelwriter 等内部目录） */
export function collectIndexableDocs(projectPath: string): IndexedDoc[] {
  const docs: IndexedDoc[] = []
  if (projectPath && statSyncSafe(projectPath)) collectDir(projectPath, projectPath, docs)
  return docs
}

function statSyncSafe(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
