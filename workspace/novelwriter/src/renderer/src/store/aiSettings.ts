import { create } from 'zustand'

export interface AIConfig {
  provider: 'openai' | 'ollama'
  apiKey: string
  baseUrl: string
  model: string
}

interface AISettingsState {
  showSettings: boolean
  config: AIConfig
  setShowSettings: (show: boolean) => void
  setConfig: (config: Partial<AIConfig>) => void
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<void>
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  showSettings: false,
  config: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
  },

  setShowSettings: (show) => set({ showSettings: show }),

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  loadConfig: async () => {
    try {
      const config = await window.api.getAIConfig?.() ?? get().config
      set({ config })
    } catch {
      // ignore
    }
  },

  saveConfig: async () => {
    try {
      await window.api.saveAIConfig?.(get().config)
    } catch {
      // ignore
    }
  }
}))
