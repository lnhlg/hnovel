// 临时调试脚本：测量"保存后全量重建索引"在主线程上的真实耗时
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, basename, dirname } from 'path'
import { performance } from 'perf_hooks'
import initSqlJs from 'sql.js'

const SKIP_DIRS = new Set(['.novelwriter', '.novelwriter-backups', '.arts', '.codeartsdoer', 'node_modules', '.git'])

function collectDir(projectPath, dir, out) {
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
      const isRoot = dirname(full) === projectPath
      const kind = isRoot ? '根目录' : basename(dirname(full))
      const title = basename(full, '.md')
      const orderMatch = title.match(/^(\d+)[.\s-_]/)
      let body = ''
      try {
        body = readFileSync(full, 'utf-8')
      } catch { /* ignore */ }
      out.push({ docId: rel, kind, title, body, chapterOrder: orderMatch ? parseInt(orderMatch[1], 10) : 0 })
    }
  }
}

function collectDocs(projectPath) {
  const docs = []
  try {
    if (statSync(projectPath).isDirectory()) collectDir(projectPath, projectPath, docs)
  } catch { /* ignore */ }
  return docs
}

const userData = process.env.APPDATA ?? ''
const projects = JSON.parse(readFileSync(join(userData, 'novelwriter', 'novelwriter', 'projects.json'), 'utf-8'))
const SQL = await initSqlJs()

for (const p of projects) {
  if (!p.path || !statSync(p.path).isDirectory()) continue
  const t0 = performance.now()
  const docs = collectDocs(p.path)
  const t1 = performance.now()
  const db = new SQL.Database()
  db.run('CREATE TABLE search_docs (doc_id TEXT PRIMARY KEY, kind TEXT, title TEXT, body TEXT, chapter_order INTEGER)')
  const stmt = db.prepare('INSERT INTO search_docs (doc_id, kind, title, body, chapter_order) VALUES (?,?,?,?,?)')
  for (const d of docs) stmt.run([d.docId, d.kind, d.title, d.body, d.chapterOrder])
  stmt.free()
  const t2 = performance.now()
  const buf = db.export()
  const t3 = performance.now()
  console.log(`项目=${p.name}`)
  console.log(`  docs=${docs.length} 扫描=${(t1 - t0).toFixed(0)}ms 建索引=${(t2 - t1).toFixed(0)}ms 导出db=${(t3 - t2).toFixed(0)}ms db=${(buf.length / 1024 / 1024).toFixed(1)}MB 合计=${(t3 - t0).toFixed(0)}ms`)
}
