import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import { Character,
  loadAIProviders
} from '../fileStorage'
import {
  getActiveProvider,
  chatOpenAI,
  chatOllama,
  loadActiveProvider,
  registerAbortController,
  releaseAbortController
} from '../ai'


import { ensureModel, extractFirstBalanced } from './helpers'
import { buildAssetPrompt } from '../prompts'
import type { GenerateAssetRequest } from '../prompts'



export function parseCharacterFromContent(content: string): Partial<Character> {
  const nameMatch = content.match(/^#\s+(.+)/m)
  const idMatch = content.match(/ID[：:]\s*(.+)/)
  const roleMatch = content.match(/\*\*角色定位\*\*[：:]\s*(.+)/)
  const ageMatch = content.match(/\*\*年龄\*\*[：:]\s*(.+)/)
  const appearanceMatch = content.match(/## 外貌描写\s*\n([\s\S]*?)(?=##|$)/)
  const personalityMatch = content.match(/## 性格特点\s*\n([\s\S]*?)(?=##|$)/)
  const traitsMatch = content.match(/### 性格特征\s*\n([\s\S]*?)(?=##|$)/)
  const backgroundMatch = content.match(/## 背景故事\s*\n([\s\S]*?)(?=##|$)/)
  const descMatch = content.match(/## 简要描述\s*\n([\s\S]*?)(?=##|$)/)

  return {
    id: idMatch?.[1]?.trim() || '',
    name: nameMatch?.[1]?.trim() || '',
    role: roleMatch?.[1]?.trim() || '',
    age: parseInt(ageMatch?.[1]?.trim() || '0') || 0,
    appearance: appearanceMatch?.[1]?.trim() || '',
    personality: personalityMatch?.[1]?.trim() || '',
    traits: traitsMatch?.[1]?.trim() || '',
    background: backgroundMatch?.[1]?.trim() || '',
    description: descMatch?.[1]?.trim() || ''
  }
}



function extractJson(text: string): unknown {
  // 优先匹配 ```json ... ``` 块
  const fence = text.match(/```json\s*([\s\S]*?)\s*```/i)
  if (fence) {
    try { return JSON.parse(fence[1]) } catch { /* fall through */ }
  }
  // 否则尝试提取配对的 JSON 数组/对象（括号配对，避免误抓说明文字）
  const arrText = extractFirstBalanced(text, '[', ']')
  if (arrText) {
    try { return JSON.parse(arrText) } catch { /* fall through */ }
  }
  const objText = extractFirstBalanced(text, '{', '}')
  if (objText) {
    try { return JSON.parse(objText) } catch { /* fall through */ }
  }
  return null
}



export function registerAIAssetHandlers(): void {
  ipcMain.handle('ai:generateAsset', async (_event, req: GenerateAssetRequest) => {
    let provider = getActiveProvider()
    if (!provider) {
      loadActiveProvider()
      provider = getActiveProvider()
    }
    if (req.providerId) {
      provider = loadAIProviders().find(p => p.id === req.providerId) ?? provider
    }
    if (!provider) {
      throw new Error('请先配置 AI 供应商并设为当前使用')
    }

    const model = req.model || await ensureModel(provider)
    const { system, user } = buildAssetPrompt(req)

    let result: string
    const rid = req.requestId || randomUUID()
    const abortController = new AbortController()
    registerAbortController(rid, abortController)
    try {
      if (provider.type === 'ollama') {
        result = await chatOllama(provider, model, [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ], undefined, abortController.signal)
      } else {
        result = await chatOpenAI(provider, model, [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ], abortController.signal)
      }
    } finally {
      releaseAbortController(rid)
    }

    // chapter-outline 返回纯文本大纲，不做 JSON 解析
    if (req.type === 'chapter-outline') {
      // 去除可能被模型误加的 ``` 代码块包裹
      const cleaned = result.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      return { data: { outline: cleaned } }
    }

    const parsed = extractJson(result)
    if (parsed === null) {
      return { error: 'AI 返回格式不正确', raw: result }
    }
    return { data: parsed }
  })
}
