


import {
  getCurrentModel,
  setCurrentModel,
  listOpenAIModels,
  listOllamaModels
} from '../ai'
import type { AIProvider } from '../fileStorage'




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



// 确保有可用的模型：如果当前模型为空，自动获取第一个
async function ensureModel(provider: AIProvider): Promise<string> {
  let model = getCurrentModel()
  if (model) return model

  // 模型为空，自动获取列表
  const models = provider.type === 'ollama'
    ? await listOllamaModels(provider)
    : await listOpenAIModels(provider)

  if (models.length > 0) {
    model = models[0].id
    setCurrentModel(model)
    return model
  }

  // 获取不到列表，用默认模型名
  model = provider.type === 'ollama' ? 'qwen2.5' : 'gpt-3.5-turbo'
  setCurrentModel(model)
  return model
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

export { now, extractTitleFromBody, extractTitleFromBodyMD, ensureModel, extractField, extractListItems, extractConflict, extractCharChanges }
