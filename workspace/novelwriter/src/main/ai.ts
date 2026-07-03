import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { AIProvider, loadAIProviders, saveAIProvider, deleteAIProvider as deleteAIProviderFile } from './fileStorage'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelInfo {
  id: string
  name: string
  owned_by?: string
  size?: number
}

// 当前活跃的供应商配置（内存缓存）
let activeProvider: AIProvider | null = null

// 获取活跃供应商配置
export function getActiveProvider(): AIProvider | null {
  return activeProvider
}

// 设置活跃供应商
export function setActiveProvider(provider: AIProvider): void {
  activeProvider = provider
}

// 根据 API 类型获取完整的 API URL
function getApiUrl(baseUrl: string, type: 'openai' | 'ollama', endpoint: 'chat' | 'models'): string {
  // 移除末尾的斜杠
  const base = baseUrl.replace(/\/+$/, '')
  
  if (type === 'ollama') {
    // Ollama API 路径
    if (endpoint === 'chat') {
      return `${base}/api/chat`
    } else {
      return `${base}/api/tags`
    }
  } else {
    // OpenAI 兼容 API 路径
    if (endpoint === 'chat') {
      return `${base}/v1/chat/completions`
    } else {
      return `${base}/v1/models`
    }
  }
}

// 从文件加载活跃供应商
export function loadActiveProvider(): AIProvider | null {
  const providers = loadAIProviders()
  const active = providers.find(p => p.isActive === 1)
  if (active) {
    activeProvider = active
    if (active.model) {
      currentModel = active.model
    }
    return active
  }
  return null
}

// OpenAI 兼容 API 调用（非流式）
export async function chatOpenAI(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const url = getApiUrl(provider.baseUrl, 'openai', 'chat')
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    }),
    signal
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// OpenAI 兼容 API 调用（流式）
export async function chatOpenAIStream(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const url = getApiUrl(provider.baseUrl, 'openai', 'chat')
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    }),
    signal
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })
    const lines = text.split('\n').filter((l) => l.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content ?? ''
        if (content) {
          fullContent += content
          onChunk(content)
        }
      } catch {
        // skip parse errors for incomplete chunks
      }
    }
  }

  return fullContent
}

// Ollama API 调用
export async function chatOllama(
  provider: AIProvider,
  model: string,
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const url = getApiUrl(provider.baseUrl, 'ollama', 'chat')
  const isStream = !!onChunk
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: isStream
    }),
    signal
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  if (isStream) {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          const content = parsed.message?.content ?? ''
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch {
          // skip
        }
      }
    }

    return fullContent
  } else {
    const data = await response.json()
    return data.message?.content ?? ''
  }
}

// 获取 OpenAI 兼容 API 的模型列表
export async function listOpenAIModels(provider: AIProvider): Promise<ModelInfo[]> {
  const url = getApiUrl(provider.baseUrl, 'openai', 'models')
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`
      }
    })

    if (!response.ok) {
      throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((m: { id: string; owned_by?: string }) => ({
        id: m.id,
        name: m.id,
        owned_by: m.owned_by
      }))
    }
    return []
  } catch (error) {
    console.error('获取 OpenAI 模型列表失败:', error)
    return []
  }
}

// 获取 Ollama 模型列表
export async function listOllamaModels(provider: AIProvider): Promise<ModelInfo[]> {
  const url = getApiUrl(provider.baseUrl, 'ollama', 'models')
  
  try {
    const response = await fetch(url, {
      method: 'GET'
    })

    if (!response.ok) {
      throw new Error(`获取 Ollama 模型列表失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((m: { name: string; size?: number }) => ({
        id: m.name,
        name: m.name,
        size: m.size
      }))
    }
    return []
  } catch (error) {
    console.error('获取 Ollama 模型列表失败:', error)
    return []
  }
}

// 当前使用的模型（从活跃供应商配置中获取或使用默认值）
let currentModel: string = ''

export function getCurrentModel(): string {
  return currentModel
}

export function setCurrentModel(model: string): void {
  currentModel = model
  // 持久化到文件
  if (activeProvider) {
    saveAIProvider({ ...activeProvider, model })
  }
}

export function registerAIHandlers(): void {
  // 获取当前活跃供应商和模型
  ipcMain.handle('ai:getCurrentConfig', () => {
    return {
      provider: activeProvider,
      model: currentModel
    }
  })

  // 设置当前模型
  ipcMain.handle('ai:setModel', (_event, model: string) => {
    setCurrentModel(model)
    return { success: true, model }
  })

  // 获取所有供应商列表
  ipcMain.handle('ai:listProviders', () => {
    return loadAIProviders().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  })

  // 创建或更新供应商
  ipcMain.handle('ai:saveProvider', (_event, data: Partial<AIProvider> & { id?: string }) => {
    const time = new Date().toISOString()
    const providers = loadAIProviders()

    if (data.id) {
      // 更新
      const existing = providers.find(p => p.id === data.id)
      if (!existing) return null
      const updated: AIProvider = {
        ...existing,
        name: data.name ?? existing.name,
        type: data.type ?? existing.type,
        baseUrl: data.baseUrl ?? existing.baseUrl,
        apiKey: data.apiKey ?? existing.apiKey,
        updatedAt: time
      }
      saveAIProvider(updated)
      return updated
    } else {
      // 创建 - 检查是否是第一个供应商，如果是则自动设为活跃
      const isFirst = providers.length === 0
      const id = randomUUID()
      const provider: AIProvider = {
        id,
        name: data.name ?? '',
        type: data.type ?? 'openai',
        baseUrl: data.baseUrl ?? '',
        apiKey: data.apiKey ?? '',
        model: '',
        isActive: isFirst ? 1 : 0,
        createdAt: time,
        updatedAt: time
      }
      saveAIProvider(provider)

      // 如果是第一个供应商，更新缓存
      if (isFirst) {
        loadActiveProvider()
      }
      return provider
    }
  })

  // 设置活跃供应商
  ipcMain.handle('ai:setActiveProvider', (_event, providerId: string) => {
    const providers = loadAIProviders()
    for (const p of providers) {
      p.isActive = p.id === providerId ? 1 : 0
      saveAIProvider(p)
    }

    // 重新加载活跃供应商
    loadActiveProvider()

    return { success: true }
  })

  // 删除供应商
  ipcMain.handle('ai:deleteProvider', (_event, providerId: string) => {
    deleteAIProviderFile(providerId)

    // 如果删除的是活跃供应商，重新加载
    if (activeProvider?.id === providerId) {
      loadActiveProvider()
    }

    return { success: true }
  })

  // 测试连接
  ipcMain.handle('ai:testConnection', async (_event, arg?: string | { type: string; baseUrl: string; apiKey?: string }) => {
    let provider = activeProvider

    // 如果 arg 是字符串，当作 providerId 处理
    if (typeof arg === 'string') {
      provider = loadAIProviders().find(p => p.id === arg) ?? null
    } else if (arg && typeof arg === 'object' && arg.baseUrl) {
      // 如果是对象，当作临时配置处理
      provider = {
        id: 'temp',
        name: '临时测试',
        type: arg.type === 'ollama' ? 'ollama' : 'openai',
        baseUrl: arg.baseUrl,
        apiKey: arg.apiKey ?? '',
        model: '',
        isActive: 0,
        createdAt: '',
        updatedAt: ''
      }
    }

    if (!provider) {
      return { success: false, error: '没有可用的供应商配置' }
    }

    try {
      if (provider.type === 'ollama') {
        // Ollama 测试：调用 /api/tags
        const url = getApiUrl(provider.baseUrl, 'ollama', 'models')
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) })
        if (!response.ok) {
          return { success: false, error: `连接失败: ${response.status} ${response.statusText}` }
        }
        const data = await response.json()
        const modelCount = data.models?.length ?? 0
        return { success: true, message: `连接成功！可用模型: ${modelCount} 个`, modelCount }
      } else {
        // OpenAI 测试：调用 /v1/models
        const url = getApiUrl(provider.baseUrl, 'openai', 'models')
        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${provider.apiKey}` },
          signal: AbortSignal.timeout(10000)
        })
        if (!response.ok) {
          const errorText = await response.text()
          return { success: false, error: `连接失败: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}` }
        }
        const data = await response.json()
        const modelCount = data.data?.length ?? 0
        return { success: true, message: `连接成功！可用模型: ${modelCount} 个`, modelCount }
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      if (error instanceof Error) {
        return { success: false, error: error.message }
      }
      return { success: false, error: '未知错误' }
    }
  })

  // 获取指定供应商的模型列表
  ipcMain.handle('ai:listModels', async (_event, providerId?: string) => {
    // 如果提供了 providerId，查询该供应商；否则使用当前活跃供应商
    let provider = activeProvider

    if (providerId) {
      provider = loadAIProviders().find(p => p.id === providerId) ?? null
    }

    if (!provider) {
      return []
    }

    if (provider.type === 'ollama') {
      return await listOllamaModels(provider)
    } else {
      return await listOpenAIModels(provider)
    }
  })

  // AI 聊天（使用当前活跃供应商和模型，可通过 options.model 临时切换模型）
  ipcMain.handle('ai:chat', async (event, messages: ChatMessage[], options?: { stream?: boolean; model?: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const isStream = options?.stream ?? false
    const model = options?.model || currentModel

    if (!activeProvider) {
      throw new Error('请先配置 AI 供应商')
    }

    if (!model) {
      throw new Error('请先选择模型')
    }

    if (activeProvider.type === 'ollama') {
      if (isStream && window) {
        return await chatOllama(activeProvider, model, messages, (chunk) => {
          window.webContents.send('ai:chunk', chunk)
        })
      }
      return await chatOllama(activeProvider, model, messages)
    } else {
      if (isStream && window) {
        return await chatOpenAIStream(activeProvider, model, messages, (chunk) => {
          window.webContents.send('ai:chunk', chunk)
        })
      }
      return await chatOpenAI(activeProvider, model, messages)
    }
  })

  // 供其他模块调用的聊天接口（指定供应商和模型）
  ipcMain.handle('ai:chatWithProvider', async (_event, providerId: string, model: string, messages: ChatMessage[], options?: { stream?: boolean; sessionId?: string }) => {
    const provider = loadAIProviders().find(p => p.id === providerId)
    if (!provider) {
      throw new Error('供应商不存在')
    }

    const window = BrowserWindow.getFocusedWindow()
    const sendChunk = options?.sessionId && window
      ? (chunk: string) => window.webContents.send('wizard:chunk', options.sessionId, chunk)
      : (options?.stream && window ? (chunk: string) => window.webContents.send('ai:chunk', chunk) : () => {})

    if (provider.type === 'ollama') {
      return await chatOllama(provider, model, messages, options?.stream ? sendChunk : undefined)
    } else {
      if (options?.stream) {
        return await chatOpenAIStream(provider, model, messages, sendChunk)
      }
      return await chatOpenAI(provider, model, messages)
    }
  })
}