import { readFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'
import { atomicWriteBuffer } from './atomicWrite'
import type { IndexedDoc } from './indexDocs'

const require = createRequire(import.meta.url)

let sqlPromise: Promise<SqlJsStatic> | null = null
function getSQL(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
  })
  return sqlPromise
}

export interface SearchHit {
  docId: string
  kind: string
  title: string
  snippet: string
  chapterOrder: number
}

export interface SearchOptions {
  kinds?: string[]
  limit?: number
}

export interface Foreshadow {
  id: string
  title: string
  status: 'planted' | 'active' | 'resolved'
  chapterId?: string
  marker?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

function ensureSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS search_docs (
      doc_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      chapter_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS foreshadows (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planted',
      chapter_id TEXT,
      marker TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

export async function openIndex(dbPath: string): Promise<Database> {
  const SQL = await getSQL()
  const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database()
  ensureSchema(db)
  return db
}

export function saveIndex(db: Database, dbPath: string): void {
  atomicWriteBuffer(dbPath, db.export())
}

export function clearSearchDocs(db: Database): void {
  db.run('DELETE FROM search_docs')
}

export function insertSearchDocs(db: Database, docs: IndexedDoc[]): void {
  const stmt = db.prepare(
    'INSERT INTO search_docs (doc_id, kind, title, body, chapter_order) VALUES (?, ?, ?, ?, ?)'
  )
  for (const d of docs) {
    stmt.run([d.docId, d.kind, d.title, d.body, d.chapterOrder])
  }
  stmt.free()
}

export function rebuildSearchIndex(db: Database, docs: IndexedDoc[]): void {
  clearSearchDocs(db)
  insertSearchDocs(db, docs)
}

function snippet(body: string, query: string, radius = 40): string {
  const idx = body.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return body.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(body.length, idx + query.length + radius)
  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`
}

export function searchIndex(db: Database, query: string, options?: SearchOptions): SearchHit[] {
  const q = query.trim()
  if (!q) return []
  const like = `%${q}%`
  const params: Array<string | number | null> = [like, like]
  let sql = 'SELECT doc_id, kind, title, body, chapter_order FROM search_docs WHERE title LIKE ? OR body LIKE ?'
  if (options?.kinds?.length) {
    sql += ` AND kind IN (${options.kinds.map(() => '?').join(', ')})`
    params.push(...options.kinds)
  }
  sql += ' ORDER BY chapter_order, doc_id LIMIT ?'
  params.push(Math.min(options?.limit ?? 50, 200))

  const result = db.exec(sql, params)
  if (result.length === 0) return []
  const rows = result[0].values
  return rows.map(row => ({
    docId: String(row[0]),
    kind: String(row[1]),
    title: String(row[2]),
    snippet: snippet(String(row[3]), q),
    chapterOrder: Number(row[4] ?? 0)
  }))
}

export function listForeshadows(db: Database): Foreshadow[] {
  const result = db.exec(
    'SELECT id, title, status, chapter_id, marker, notes, created_at, updated_at FROM foreshadows ORDER BY updated_at DESC'
  )
  if (result.length === 0) return []
  return result[0].values.map(row => ({
    id: String(row[0]),
    title: String(row[1]),
    status: String(row[2]) as Foreshadow['status'],
    chapterId: row[3] === null ? undefined : String(row[3]),
    marker: row[4] === null ? undefined : String(row[4]),
    notes: row[5] === null ? undefined : String(row[5]),
    createdAt: String(row[6]),
    updatedAt: String(row[7])
  }))
}

export function saveForeshadow(db: Database, f: Foreshadow): void {
  db.run(
    `INSERT OR REPLACE INTO foreshadows (id, title, status, chapter_id, marker, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [f.id, f.title, f.status, f.chapterId ?? null, f.marker ?? null, f.notes ?? null, f.createdAt, f.updatedAt]
  )
}

export function deleteForeshadow(db: Database, id: string): void {
  db.run('DELETE FROM foreshadows WHERE id = ?', [id])
}
