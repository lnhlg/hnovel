import React, { useState, useEffect } from 'react'
import { RefreshCw, Plus, Trash2, Check, Edit2, X, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import { useAISettingsStore } from '../store/aiSettings'

interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'ollama'
  baseUrl: string
  apiKey: string
  isActive: number
  createdAt: string
  updatedAt: string
}

interface ModelInfo {
  id: string
  name: string
  owned_by?: string
  size?: number
}

interface TestResult {
  success: boolean
  message?: string
  error?: string
  modelCount?: number
}

interface AISettingsPanelProps {
  onClose: () => void
}

function AISettingsPanel({ onClose }: AISettingsPanelProps): JSX.Element {
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [currentModel, setCurrentModel] = useState('')
  const [editingProvider, setEditingProvider] = useState<Partial<AIProvider> | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const loadProviders = async (): Promise<void> => {
    const result = await window.api.listProviders?.()
    if (result && Array.isArray(result)) {
      setProviders(result)
    }
  }

  const loadCurrentConfig = async (): Promise<void> => {
    const result = await window.api.getCurrentConfig?.()
    if (result) {
      setCurrentModel(result.model ?? '')
    }
  }

  const loadModels = async (providerId?: string): Promise<void> => {
    setLoadingModels(true)
    setModelError('')
    try {
      const result = await window.api.listModels?.(providerId)
      if (result && Array.isArray(result)) {
        setModels(result)
      } else {
        setModels([])
      }
    } catch (err) {
      console.error('获取模型列表失败:', err)
      setModelError(err instanceof Error ? err.message : '获取模型列表失败')
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const testConnection = async (): Promise<void> => {
    if (!editingProvider?.baseUrl?.trim()) {
      alert('请先输入 API 地址')
      return
    }
    setTestingConnection(true)
    setTestResult(null)
    try {
      const result = await window.api.testConnection?.({
        type: editingProvider.type ?? 'openai',
        baseUrl: editingProvider.baseUrl,
        apiKey: editingProvider.apiKey
      })
      if (result) {
        setTestResult(result as TestResult)
      }
    } catch (err) {
      console.error('测试连接失败:', err)
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : '测试连接失败'
      })
    } finally {
      setTestingConnection(false)
    }
  }

  useEffect(() => {
    loadProviders()
    loadCurrentConfig()
  }, [])

  useEffect(() => {
    const activeProvider = providers.find(p => p.isActive === 1)
    if (activeProvider) {
      loadModels(activeProvider.id)
    }
  }, [providers.find(p => p.isActive === 1)?.id])

  const handleSetActive = async (providerId: string): Promise<void> => {
    await window.api.setActiveProvider?.(providerId)
    await loadProviders()
    setCurrentModel('')
    setTestResult(null)
    // 同步 Zustand store 以便状态栏显示当前供应商信息
    const activeProvider = providers.find(p => p.id === providerId)
    if (activeProvider) {
      useAISettingsStore.getState().setConfig({
        provider: activeProvider.type,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: ''
      })
    }
  }

  const handleSetModel = async (model: string): Promise<void> => {
    await window.api.setModel?.(model)
    setCurrentModel(model)
    // 同步 Zustand store 以便状态栏显示正确的模型名
    useAISettingsStore.getState().setConfig({ model })
  }

  const handleSaveProvider = async (): Promise<void> => {
    if (!editingProvider) return
    if (!editingProvider.name?.trim()) {
      alert('请输入供应商名称')
      return
    }
    if (!editingProvider.baseUrl?.trim()) {
      alert('请输入 API 地址')
      return
    }

    const result = await window.api.saveProvider?.({
      id: editingProvider.id,
      name: editingProvider.name.trim(),
      type: editingProvider.type ?? 'openai',
      baseUrl: editingProvider.baseUrl.trim(),
      apiKey: editingProvider.apiKey ?? ''
    })

    if (result) {
      await loadProviders()
      setEditingProvider(null)
    }
  }

  const handleDeleteProvider = async (providerId: string): Promise<void> => {
    if (!confirm('确定要删除这个供应商吗？')) return
    await window.api.deleteProvider?.(providerId)
    await loadProviders()
  }

  const handleEditProvider = (provider: AIProvider): void => {
    setEditingProvider({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey
    })
    setTestResult(null)
  }

  const handleNewProvider = (): void => {
    setEditingProvider({
      name: '',
      type: 'openai',
      baseUrl: '',
      apiKey: ''
    })
    setTestResult(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="rounded-xl p-6 shadow-2xl flex flex-col"
        style={{
          width: 600,
          maxHeight: '80vh',
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)'
        }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>AI 供应商管理</h2>
          <button onClick={onClose} className="icon-btn" style={{ width: 24, height: 24 }}>
            <X size={16} />
          </button>
        </div>

        {/* 当前状态 */}
        {providers.find(p => p.isActive === 1) && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)'
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: 'rgb(22,163,74)' }}>
              <CheckCircle2 size={16} />
              <span>当前使用: <strong>{providers.find(p => p.isActive === 1)?.name}</strong></span>
              {currentModel && <span> / 模型: <strong>{currentModel}</strong></span>}
            </div>
          </div>
        )}

        {/* 模型选择（活跃供应商） */}
        {providers.find(p => p.isActive === 1) && (
          <div
            className="mb-4 p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--color-sidebar)',
              border: '1px solid var(--color-border-light)'
            }}
          >
            <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              当前模型
            </label>
            <div className="flex gap-2">
              {models.length > 0 ? (
                <select
                  value={currentModel}
                  onChange={(e) => handleSetModel(e.target.value)}
                  className="input flex-1"
                  disabled={loadingModels}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.owned_by ? `(${m.owned_by})` : ''} {m.size ? ` - ${Math.round(m.size / 1024 / 1024 / 1024)}GB` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={currentModel}
                  onChange={(e) => setCurrentModel(e.target.value)}
                  onBlur={() => handleSetModel(currentModel)}
                  placeholder="输入模型名称..."
                  className="input flex-1"
                  disabled={loadingModels}
                />
              )}
              <button
                onClick={() => loadModels(providers.find(p => p.isActive === 1)?.id)}
                disabled={loadingModels}
                className="btn btn-ghost"
                title="刷新模型列表"
              >
                <RefreshCw size={16} className={loadingModels ? 'animate-spin' : ''} />
              </button>
            </div>
            {modelError && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-danger)' }}>{modelError}</p>
            )}
          </div>
        )}

        {/* 供应商列表 */}
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              供应商列表
            </span>
            <button
              onClick={handleNewProvider}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--color-accent)' }}
            >
              <Plus size={14} />
              <span>添加供应商</span>
            </button>
          </div>

          {/* 编辑/新建供应商表单 */}
          {editingProvider && (
            <div
              className="mb-3 p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.3)'
              }}
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    名称
                  </label>
                  <input
                    type="text"
                    value={editingProvider.name ?? ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                    placeholder="例如: OpenAI、Ollama本地..."
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    API 类型
                  </label>
                  <select
                    value={editingProvider.type ?? 'openai'}
                    onChange={(e) => setEditingProvider({ ...editingProvider, type: e.target.value as 'openai' | 'ollama' })}
                    className="input w-full"
                  >
                    <option value="openai">OpenAI 兼容 API（自动添加 /v1 路径）</option>
                    <option value="ollama">Ollama（自动添加 /api 路径）</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    Base URL <span style={{ color: 'var(--color-text-secondary)' }}>(无需添加 /v1 或 /api)</span>
                  </label>
                  <input
                    type="text"
                    value={editingProvider.baseUrl ?? ''}
                    onChange={(e) => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                    placeholder={editingProvider.type === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com'}
                    className="input w-full"
                  />
                </div>
                {editingProvider.type === 'openai' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      API Key
                    </label>
                    <input
                      type="password"
                      value={editingProvider.apiKey ?? ''}
                      onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="input w-full"
                    />
                  </div>
                )}

                {/* 测试连接按钮 */}
                <div>
                  <button
                    onClick={testConnection}
                    disabled={testingConnection || !editingProvider.baseUrl?.trim()}
                    className="btn btn-ghost flex items-center gap-1.5"
                  >
                    {testingConnection ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Wifi size={14} />
                    )}
                    <span>测试连接</span>
                  </button>
                  {testResult && (
                    <div
                      className="mt-2 text-xs p-2 rounded"
                      style={{
                        backgroundColor: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: testResult.success ? 'rgb(22,163,74)' : 'var(--color-danger)'
                      }}
                    >
                      {testResult.success ? (
                        <div className="flex items-center gap-1">
                          <Check size={12} />
                          <span>{testResult.message}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <WifiOff size={12} />
                          <span>{testResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingProvider(null)}
                    className="btn btn-ghost"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveProvider}
                    className="btn btn-primary"
                  >
                    <Check size={14} />
                    <span>保存</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 供应商卡片列表 */}
          {providers.length === 0 && !editingProvider ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-sm">暂无供应商配置</p>
              <button
                onClick={handleNewProvider}
                className="mt-2 text-xs"
                style={{ color: 'var(--color-accent)' }}
              >
                点击添加第一个供应商
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: provider.isActive === 1
                      ? 'rgba(34,197,94,0.08)'
                      : 'var(--color-surface)',
                    border: `1px solid ${provider.isActive === 1 ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {provider.isActive === 1 && (
                        <CheckCircle2 size={16} style={{ color: 'rgb(34,197,94)' }} />
                      )}
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          {provider.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {provider.type === 'ollama' ? 'Ollama' : 'OpenAI兼容'} · {provider.baseUrl}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {provider.isActive !== 1 && (
                        <button
                          onClick={() => handleSetActive(provider.id)}
                          className="btn btn-ghost text-xs"
                          style={{ color: 'rgb(22,163,74)' }}
                        >
                          使用
                        </button>
                      )}
                      <button
                        onClick={() => handleEditProvider(provider)}
                        className="btn btn-ghost"
                        style={{ width: 28, height: 28, padding: 0 }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="btn btn-ghost"
                        style={{ width: 28, height: 28, padding: 0, color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            完成
          </button>
        </div>
      </div>
    </div>
  )
}

export default AISettingsPanel
