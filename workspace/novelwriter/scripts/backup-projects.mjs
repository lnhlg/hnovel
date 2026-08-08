#!/usr/bin/env node
/**
 * 手动 / 计划任务备份所有 NovelWriter 项目数据（.novelwriter 目录）。
 *
 * 用法：
 *   node scripts/backup-projects.mjs [--keep 8] [--data-dir <目录>]
 *
 * 说明：
 *   - 默认读取 %APPDATA%/novelwriter/novelwriter/projects.json
 *   - 备份到各项目目录下的 .novelwriter-backups/<时间戳>（无 path 的项目放 data-dir/backups/<id>）
 *   - 同一自然日每个项目只备份一次，保留最近 keep 份
 */
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const keepIdx = args.indexOf('--keep')
const keep = keepIdx >= 0 ? (parseInt(args[keepIdx + 1], 10) || 8) : 8
const dataIdx = args.indexOf('--data-dir')
const dataDir = dataIdx >= 0
  ? args[dataIdx + 1]
  : path.join(process.env.APPDATA || '', 'novelwriter', 'novelwriter')

const projectsFile = path.join(dataDir, 'projects.json')
if (!fs.existsSync(projectsFile)) {
  console.error('找不到 projects.json:', projectsFile)
  process.exit(1)
}

const pad = (n) => String(n).padStart(2, '0')
const stamp = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}`
}
const listDirs = (dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(n => {
    try { return fs.statSync(path.join(dir, n)).isDirectory() } catch { return false }
  })
}
const prune = (root, keepCount) => {
  for (const name of listDirs(root).sort().reverse().slice(keepCount)) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true })
  }
}

const projects = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'))
let made = 0
let skipped = 0

for (const project of projects) {
  const src = project.path
    ? path.join(project.path, '.novelwriter')
    : path.join(dataDir, 'data', project.id)
  const root = project.path
    ? path.join(project.path, '.novelwriter-backups')
    : path.join(dataDir, 'backups', project.id)

  if (!fs.existsSync(src) || fs.readdirSync(src).length === 0) continue
  const today = stamp().slice(0, 10)
  if (listDirs(root).some(n => n.startsWith(today))) {
    console.log(`跳过 ${project.name}: 今天已备份`)
    skipped++
    continue
  }

  let target = path.join(root, stamp())
  let suffix = 2
  while (fs.existsSync(target)) {
    target = path.join(root, `${path.basename(target)}-${suffix}`)
    suffix++
  }
  fs.mkdirSync(root, { recursive: true })
  fs.cpSync(src, target, { recursive: true })
  prune(root, keep)
  console.log(`已备份 ${project.name} -> ${target}`)
  made++
}

console.log(`完成：新建 ${made} 份，跳过 ${skipped} 个`)
