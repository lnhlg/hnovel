import { randomUUID } from 'crypto'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  getActiveProvider,
  getCurrentModel,
  setCurrentModel,
  listOpenAIModels,
  listOllamaModels
} from '../ai'
import { loadProjectById, loadChapters, saveChapter } from '../fileStorage'
import type { AIProvider, Chapter } from '../fileStorage'
import { stripChapterTitle, saveChapterMD } from '../markdownStorage'




function now(): string {
  return new Date().toISOString()
}



// 从正文内容开头解析章节标题，如 "第1章 惊变" / "第一章 惊变" / "Chapter 1 惊变"
// 返回完整标题行（含编号前缀），由侧栏显示时统一裁前缀；未匹配返回空串
function extractTitleFromBody(body: string): string {
  if (!body) return ''
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^第\s*[零一二三四五六七八九十百千万零壹贰叁肆伍陆柒捌玖拾佰仟\d]+\s*[章回节部]\s*[·•.、．：:\s-]*(.+)$/)
    if (m && m[1].trim()) return trimmed
    const m2 = trimmed.match(/^[Cc]hapter\s+\d+[\s-:：]*(.+)$/i)
    if (m2 && m2[1].trim()) return trimmed
    return ''
  }
  return ''
}



// 从完整 MD 文档中提取正文区域起始的章节标题
function extractTitleFromBodyMD(fullContent: string): string {
  if (!fullContent) return ''
  const header = '## 正文内容'
  const idx = fullContent.indexOf(header)
  if (idx === -1) return ''
  return extractTitleFromBody(fullContent.substring(idx + header.length))
}



// 确保有可用的模型。优先级：
//   1. 该供应商保存的 model（不污染其他供应商）
//   2. 拉取该供应商模型列表取第一个（仅对活跃供应商持久化为全局当前模型）
//   3. 全局当前模型（兜底）
//   4. 明确报错——不再硬编码可能已下线的默认模型名（gpt-3.5-turbo/qwen2.5）
async function ensureModel(provider: AIProvider): Promise<string> {
  if (provider.model) return provider.model

  const models = provider.type === 'ollama'
    ? await listOllamaModels(provider)
    : await listOpenAIModels(provider)

  if (models.length > 0) {
    const model = models[0].id
    // 只有对活跃供应商才持久化，避免把别的供应商的模型写进活跃供应商配置
    if (provider.id === getActiveProvider()?.id) {
      setCurrentModel(model)
    }
    return model
  }

  const global = getCurrentModel()
  if (global) return global

  throw new Error(`无法确定模型：请先在 AI 设置中为「${provider.name || '当前供应商'}」选择一个模型`)
}



// ===== AI 大纲与章节生成 =====

// 解析大纲中指定标题下的纯文本字段内容
function extractField(outline: string, fieldTitle: string): string {
  const regex = new RegExp(`### ${fieldTitle}\\n([\\s\\S]*?)(?=\\n### |\
$)`)
  const match = outline.match(regex)
  if (!match) return ''
  return match[1].trim().replace(/^- /gm, '').trim()
}



// 解析大纲中指定标题下的列表项
function extractListItems(outline: string, fieldTitle: string): string[] {
  const field = extractField(outline, fieldTitle)
  if (!field) return []
  const items = field.split('\n').map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim()).filter(Boolean)
  return items
}



// 解析冲突字段为字符串数组
function extractConflict(outline: string): string[] {
  const field = extractField(outline, '本章冲突')
  if (!field) return []
  return field.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
}



// 解析人物变化字段为字符串数组
function extractCharChanges(outline: string): string[] {
  const field = extractField(outline, '人物变化')
  if (!field) return []
  return field.split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
}

/**
 * 从 AI 输出中提取配对的 JSON 数组/对象文本。
 * 优先取 ```json/``` 围栏内的内容；无围栏时从全文找第一个配对括号。
 * 用括号配对而非贪婪正则，避免误抓说明文字里的括号。
 */
function extractFirstBalanced(text: string, open: '[' | '{', close: ']' | '}'): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf(open)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 统一保存章节（编辑器 Ctrl+S / 自动保存 / App 保存按钮共用）：
 * JSON 与 Markdown 同步写入，标题解析、旧文件清理只保留一份逻辑。
 */
export function saveChapterWithMd(
  projectId: string,
  data: Partial<Chapter> & { projectId: string }
): Chapter {
  const time = now()
  const project = loadProjectById(projectId)
  const existing = data.id ? loadChapters(projectId).find(c => c.id === data.id) : null

  if (existing) {
    // 标题解析优先级：正文区域起始的章节标题（如"第1章 惊变"）> preamble H1 > data.title > existing.title
    let resolvedTitle = existing.title
    if (data.content) {
      const bodyTitle = extractTitleFromBodyMD(data.content)
      if (bodyTitle) {
        resolvedTitle = bodyTitle
      } else {
        const preambleTitle = data.content.match(/^#\s+(.+)/m)?.[1]?.trim()
        if (preambleTitle) resolvedTitle = preambleTitle
        else if (data.title) resolvedTitle = data.title
      }
    } else if (data.title) {
      resolvedTitle = data.title
    }
    const chapter: Chapter = {
      ...existing,
      title: resolvedTitle,
      content: data.content ?? existing.content,
      outline: data.outline ?? existing.outline,
      sortOrder: data.sortOrder ?? existing.sortOrder,
      wordCount: data.wordCount ?? existing.wordCount,
      status: data.status ?? existing.status,
      draftVersion: data.draftVersion ?? existing.draftVersion,
      updatedAt: time
    }
    saveChapter(projectId, chapter)

    // 同步保存到 MD 文件（标题变更时清理旧文件）
    if (project && project.path) {
      const oldClean = stripChapterTitle(existing.title)
      const oldFileName = `${existing.sortOrder + 1}. ${oldClean.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '无标题'}.md`
      const oldFilePath = join(project.path, '章节', oldFileName)
      if (existsSync(oldFilePath)) unlinkSync(oldFilePath)
      saveChapterMD(project.path, chapter, chapter.sortOrder)
    }
    return chapter
  }

  const id = randomUUID()
  const chapters = loadChapters(projectId)
  const sortOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.sortOrder)) + 1 : 0
  const chapter: Chapter = {
    id, projectId,
    title: data.title ?? '未命名章节', content: data.content ?? '',
    outline: data.outline ?? '', sortOrder,
    wordCount: data.wordCount ?? 0, status: data.status ?? '草稿',
    draftVersion: data.draftVersion ?? 1,
    storyProgressSynced: 0,
    createdAt: time, updatedAt: time
  }
  saveChapter(projectId, chapter)
  if (project && project.path) {
    saveChapterMD(project.path, chapter, sortOrder)
  }
  return chapter
}

export { now, extractTitleFromBody, extractTitleFromBodyMD, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges, extractFirstBalanced }
