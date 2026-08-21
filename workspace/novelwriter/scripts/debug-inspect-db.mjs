// 临时调试脚本 v2：对比旧 SQLite 与新 JSON 中的供应商 + 各表最后写入时间
import { readFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
const db = new SQL.Database(readFileSync(join(process.env.APPDATA ?? '', 'novelwriter', 'novelwriter.db')))
const jsonProviders = JSON.parse(
  readFileSync(join(process.env.APPDATA ?? '', 'novelwriter', 'novelwriter', 'aiProviders.json'), 'utf-8')
)

const rows = db.exec('SELECT id, name, baseUrl, apiKey, model, isActive, createdAt, updatedAt FROM ai_providers')
console.log('== 旧 SQLite ai_providers ==')
for (const r of rows[0]?.values ?? []) {
  const [id, name, baseUrl, apiKey, model, isActive, createdAt, updatedAt] = r
  const match = jsonProviders.find(p => p.name === name)
  console.log(`  name=${name} baseUrl=${baseUrl} model=${model} isActive=${isActive} created=${createdAt} updated=${updatedAt}`)
  console.log(`  -> 新 JSON 中同名供应商: ${match ? `存在 (创建于 ${match.createdAt})` : '不存在'}`)
  console.log(`  -> apiKey 与新 JSON 是否一致: ${match && match.apiKey === apiKey ? '一致' : match ? '不同(可能换过 key)' : '-'}`)
}

console.log('\n== 各表最后时间戳 (max updatedAt/createdAt) ==')
const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
for (const [name] of tables[0].values) {
  const cols = db.exec(`PRAGMA table_info("${name}")`)[0].values.map(v => v[1])
  const tcol = cols.includes('updatedAt') ? 'updatedAt' : cols.includes('createdAt') ? 'createdAt' : null
  if (!tcol) { console.log(`  ${name}: 无时间列`); continue }
  const r = db.exec(`SELECT MAX("${tcol}"), COUNT(*) FROM "${name}"`)[0].values[0]
  console.log(`  ${name}: max(${tcol})=${r[0]} rows=${r[1]}`)
}
